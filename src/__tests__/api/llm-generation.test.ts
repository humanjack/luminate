import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ settings: {} as Record<string, string>, anthropic: vi.fn() }));
vi.mock("@/lib/db", () => ({ settings: {}, db: { select: () => ({ from: () => Object.entries(state.settings).map(([key, value]) => ({ key, value })) }) } }));
vi.mock("@/lib/llm/anthropicClient", () => ({ createAnthropicClient: () => ({ messages: { stream: state.anthropic } }) }));
vi.mock("@/lib/net/rateLimit", () => ({ rateLimited: () => null, LLM_CALL_LIMIT: {} }));
import { POST as content } from "@/app/api/llm/content/route";
import { POST as script } from "@/app/api/llm/script/route";
import { POST as research } from "@/app/api/llm/research/route";
import { POST as verifyAnthropic } from "@/app/api/settings/verify/anthropic/route";

function request(body: unknown, signal?: AbortSignal) {
  return new NextRequest("http://localhost/api/llm/content", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, signal });
}
function sse(events: unknown[], split = false) {
  const text = events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join("");
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    if (split) for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    else controller.enqueue(bytes);
    controller.close();
  } }));
}
beforeEach(() => {
  state.settings = { llmProvider: "openai", openaiApiKey: "saved-openai-key", openaiModel: '"chosen-model"' };
  state.anthropic.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sse([
    { type: "response.output_text.delta", delta: "Generated café" }, { type: "response.completed" },
  ], true)));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("self-contained generation routes", () => {
  it.each([
    ["content", content, { research: "Findings", format: "tutorial", targetLength: 5 }],
    ["script", script, { slideContent: "# Slide", slideIndex: 2 }],
    ["research without web search", research, { topic: "Example", depth: "quick" }],
  ] as const)("streams %s through the saved OpenAI provider without FastAPI", async (_name, handler, body) => {
    const response = await handler(request(body));
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    const output = await response.text();
    expect(output).toContain('"content":"Generated café"');
    expect(output).toContain('"type":"done"');
    expect(output).toContain("data: [DONE]");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer saved-openai-key" }),
      body: expect.stringContaining('"model":"chosen-model"'),
    }));
  });

  it("honors Google settings and excludes thought text", async () => {
    state.settings = { llmProvider: "google", googleApiKey: "saved-google-key", googleModel: "chosen-google" };
    vi.mocked(fetch).mockResolvedValue(sse([{ candidates: [{ content: { parts: [{ text: "private thought", thought: true }, { text: "Google script" }] }, finishReason: "STOP" }] }]));
    const output = await (await script(request({ slideContent: "Slide" }))).text();
    expect(output).toContain("Google script"); expect(output).not.toContain("private thought");
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("models/chosen-google:streamGenerateContent"), expect.objectContaining({ headers: expect.objectContaining({ "x-goog-api-key": "saved-google-key" }) }));
  });

  it("streams Anthropic through the local SDK", async () => {
    state.settings = { llmProvider: "anthropic", anthropicApiKey: "saved-key", claudeModel: "chosen-claude" };
    state.anthropic.mockImplementation(async function* () {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "Anthropic script" } };
      yield { type: "message_stop" };
    });
    const output = await (await script(request({ slideContent: "Slide" }))).text();
    expect(output).toContain("Anthropic script"); expect(output).toContain('"type":"done"');
    expect(state.anthropic).toHaveBeenCalledWith(expect.objectContaining({ model: "chosen-claude" }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([{}, { llmProvider: "claude-cli" }])("returns actionable configuration errors before opening a stream", async settings => {
    state.settings = settings;
    const response = await script(request({ slideContent: "Slide" }));
    expect(response.status).toBe(400); expect((await response.json()).code).toBe("LLM_CONFIGURATION"); expect(fetch).not.toHaveBeenCalled();
  });

  it.each([{ research: 42 }, { research: "text", format: "invalid" }, { research: "text", targetLength: -1 }])("validates content inputs", async body => {
    expect((await content(request(body))).status).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
  it("validates script indices", async () => {
    expect((await script(request({ slideContent: "text", slideIndex: -1 }))).status).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["upstream", "incomplete", "truncated"])("emits an SSE error without a success event on %s failure", async mode => {
    vi.mocked(fetch).mockResolvedValue(mode === "upstream" ? new Response("secret upstream detail", { status: 401 }) : sse(mode === "incomplete" ? [{ type: "response.incomplete" }] : [{ type: "response.output_text.delta", delta: "Partial" }]));
    const output = await (await script(request({ slideContent: "Slide" }))).text();
    expect(output).toContain('"type":"error"'); expect(output).not.toContain('"type":"done"'); expect(output).not.toContain("secret upstream detail");
  });

  it("aborts the upstream request when the reader disconnects", async () => {
    let upstreamSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      upstreamSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => upstreamSignal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    });
    const response = await script(request({ slideContent: "Slide" }));
    await response.body!.cancel();
    expect(upstreamSignal?.aborted).toBe(true);
  });

  it.each(["request abort", "deadline"])("cancels upstream generation on %s", async mode => {
    if (mode === "deadline") vi.useFakeTimers();
    let upstreamSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      upstreamSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => upstreamSignal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    });
    const abort = new AbortController();
    const response = await script(request({ slideContent: "Slide" }, abort.signal));
    if (mode === "request abort") abort.abort();
    else await vi.advanceTimersByTimeAsync(120_000);
    expect(upstreamSignal?.aborted).toBe(true);
    const output = await response.text();
    expect(output).toContain('"type":"error"');
    expect(output).not.toContain('"type":"done"');
  });

  it("does not mark an empty or refused response complete", async () => {
    vi.mocked(fetch).mockResolvedValue(sse([{ type: "response.completed" }]));
    const output = await (await script(request({ slideContent: "Slide" }))).text();
    expect(output).toContain('"type":"error"');
    expect(output).not.toContain('"type":"done"');
  });

  it("verifies Anthropic directly without persisting or contacting the backend", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}"));
    const response = await verifyAnthropic(request({ apiKey: "verify-key" }));
    expect(await response.json()).toEqual({ valid: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("https://api.anthropic.com/v1/models?limit=1", expect.objectContaining({ headers: expect.objectContaining({ "x-api-key": "verify-key" }) }));
  });
});
