"use client";

import { useCallback, useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";

export interface ResearchSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface StreamingMessage {
  type: "text" | "done" | "error" | "sources";
  /** Text payload for text/done/error events. Empty/absent on sources events. */
  content: string;
  /** Present for `sources` events (grounded research, Phase 1). */
  sources?: ResearchSource[];
}

// Parses an SSE byte stream into StreamingMessage objects.
async function* parseSSE(
  body: ReadableStream<Uint8Array>,
  label: string
): AsyncGenerator<StreamingMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") {
          yield { type: "done", content: "" };
          continue;
        }
        try {
          yield JSON.parse(data);
        } catch (e) {
          console.error(`[useLLM] Failed to parse ${label} response:`, data, e);
          // If it looks like plain text content, pass it through
          if (data && !data.startsWith("{") && !data.startsWith("[")) {
            yield { type: "text", content: data };
          }
        }
      }
    }
  } finally {
    // Consumers break out of the loop on error messages; cancel the
    // underlying HTTP stream so the connection doesn't linger.
    reader.cancel().catch(() => {});
  }
}

export function useLLM() {
  const { llmProvider, hasValidLLMConfig } = useSettingsStore();
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Builds a streaming generator for one LLM endpoint. All three operations
  // share the same fetch + SSE-parsing + state bookkeeping.
  const createStream = useCallback(
    (endpoint: string, label: string) =>
      async function* (payload: Record<string, unknown>): AsyncGenerator<StreamingMessage> {
        if (!hasValidLLMConfig()) {
          yield { type: "error", content: "Please configure your LLM provider in settings." };
          return;
        }

        setIsStreaming(true);
        setError(null);

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error(`Failed to start ${label} generation`);
          }
          if (!response.body) {
            throw new Error("No response body");
          }

          yield* parseSSE(response.body, label);
        } catch (err) {
          const message = (err as Error).message;
          console.error(`[useLLM] ${label} stream error:`, message);
          setError(message);
          yield { type: "error", content: message };
        } finally {
          setIsStreaming(false);
        }
      },
    [hasValidLLMConfig]
  );

  const streamResearch = useCallback(
    (topic: string, depth: "quick" | "detailed" | "comprehensive") =>
      createStream("/api/llm/research", "research")({ topic, depth }),
    [createStream]
  );

  const streamContent = useCallback(
    (research: string, format: "presentation" | "tutorial" | "explainer", targetLength: number) =>
      createStream("/api/llm/content", "content")({ research, format, targetLength }),
    [createStream]
  );

  const streamScript = useCallback(
    (slideContent: string, slideIndex: number) =>
      createStream("/api/llm/script", "script")({ slideContent, slideIndex }),
    [createStream]
  );

  return {
    streamResearch,
    streamContent,
    streamScript,
    isStreaming,
    error,
    hasValidConfig: hasValidLLMConfig(),
    provider: llmProvider,
  };
}
