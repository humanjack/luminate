import { db, settings } from "@/lib/db";
import { fail } from "@/lib/api/respond";
import { createAnthropicClient } from "./anthropicClient";

class GenerationError extends Error {}

interface GenerationConfig {
  provider: "anthropic" | "openai" | "google";
  model: string;
  apiKey: string;
}

export async function loadGenerationConfig(): Promise<GenerationConfig> {
  const rows = await db.select().from(settings);
  const values = new Map(rows.map(row => [row.key, row.value ?? ""]));
  const get = (key: string) => {
    const raw = values.get(key) ?? "";
    try { const value: unknown = JSON.parse(raw); return typeof value === "string" ? value : raw; }
    catch { return raw; }
  };
  const provider = get("llmProvider") || "openai";
  if (provider !== "anthropic" && provider !== "openai" && provider !== "google") {
    throw new GenerationError("Choose Anthropic, OpenAI, or Google in Settings. CLI generation is not supported.");
  }
  const apiKey = get(`${provider}ApiKey`);
  if (!apiKey.trim()) throw new GenerationError(`Save an API key for ${provider} in Settings before generating.`);
  const model = provider === "anthropic" ? get("claudeModel") || "claude-sonnet-4-6"
    : provider === "google" ? get("googleModel") || "gemini-3-pro-preview"
    : get("openaiModel") || "gpt-5.5";
  return { provider, apiKey, model };
}

/** Decode complete SSE frames, including network chunks split inside UTF-8 text. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (!data || data === "[DONE]") continue;
        const event: unknown = JSON.parse(data);
        if (event && typeof event === "object" && !Array.isArray(event)) yield event as Record<string, unknown>;
      }
      if (done) {
        if (buffer.trim()) throw new GenerationError("The provider ended an incomplete stream.");
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function* generateText(config: GenerationConfig, system: string, prompt: string, maxTokens: number, signal: AbortSignal) {
  const { provider, model, apiKey } = config;
  if (provider === "anthropic") {
    const stream = createAnthropicClient(apiKey, { maxRetries: 0 }).messages.stream({
      model, system, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }],
    }, { signal });
    let completed = false;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
      if (event.type === "message_delta" && event.delta.stop_reason === "max_tokens") throw new GenerationError("Generation reached its output limit. Try shorter input.");
      if (event.type === "message_stop") completed = true;
    }
    if (!completed) throw new GenerationError("The provider ended before completing the response.");
    return;
  }

  const url = provider === "openai" ? "https://api.openai.com/v1/responses"
    : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ""))}:streamGenerateContent?alt=sse`;
  const response = await fetch(url, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", ...(provider === "openai" ? { Authorization: `Bearer ${apiKey}` } : { "x-goog-api-key": apiKey }) },
    body: JSON.stringify(provider === "openai" ? {
      model, instructions: system, input: prompt, max_output_tokens: maxTokens, stream: true, store: false,
    } : {
      systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new GenerationError(`${provider} returned HTTP ${response.status}. Check your API key, model access, and quota in Settings.`);
  }
  if (!response.body) throw new GenerationError("The provider returned no response stream.");
  let completed = false;
  for await (const event of readEvents(response.body)) {
    if (event.error || event.type === "error" || event.type === "response.failed" || event.type === "response.incomplete") {
      throw new GenerationError(`${provider} could not complete generation. Try again or use shorter input.`);
    }
    if (provider === "openai") {
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") yield event.delta;
      if (event.type === "response.completed") completed = true;
    } else {
      const candidate = (event as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }> }).candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) if (typeof part.text === "string" && !part.thought) yield part.text;
      if (candidate?.finishReason) {
        if (candidate.finishReason !== "STOP") throw new GenerationError(`Google stopped generation (${candidate.finishReason}). Try shorter or different input.`);
        completed = true;
      }
    }
  }
  if (!completed) throw new GenerationError("The provider ended before completing the response.");
}

/** The public text/done/error contract consumed by useLLM, with disconnect cancellation. */
export async function generationResponse(request: Request, system: string, prompt: string, maxTokens: number): Promise<Response> {
  let config: GenerationConfig;
  try { config = await loadGenerationConfig(); }
  catch (error) { return fail("LLM_CONFIGURATION", error instanceof Error ? error.message : "Invalid LLM settings", 400); }
  const abort = new AbortController();
  const onAbort = () => abort.abort();
  if (request.signal.aborted) abort.abort();
  else request.signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => abort.abort(new Error("Generation timed out")), 120_000);
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => { if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); };
      try {
        let hasText = false;
        for await (const text of generateText(config, system, prompt, maxTokens, abort.signal)) {
          if (abort.signal.aborted) throw new GenerationError("Generation cancelled or timed out.");
          if (text) hasText = true;
          send({ type: "text", content: text });
        }
        if (abort.signal.aborted) throw new GenerationError("Generation cancelled or timed out.");
        if (!hasText) throw new GenerationError("The provider returned no text. Try a different prompt or model.");
        send({ type: "done", content: "" });
      } catch (error) {
        // Do not return raw SDK errors: upstream messages may include request details.
        send({ type: "error", content: abort.signal.aborted ? "Generation cancelled or timed out." : error instanceof GenerationError ? error.message : "Generation failed. Check your provider settings and try again." });
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener("abort", onAbort);
        if (!cancelled) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      }
    },
    cancel() { cancelled = true; abort.abort(); clearTimeout(timer); request.signal.removeEventListener("abort", onAbort); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
