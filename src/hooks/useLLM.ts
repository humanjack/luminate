"use client";

import { useCallback, useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";

export interface StreamingMessage {
  type: "text" | "done" | "error";
  content: string;
}

export function useLLM() {
  const { llmProvider, anthropicApiKey, claudeModel, hasValidLLMConfig } = useSettingsStore();
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamResearch = useCallback(
    async function* (
      topic: string,
      depth: "quick" | "detailed" | "comprehensive"
    ): AsyncGenerator<StreamingMessage> {
      if (!hasValidLLMConfig()) {
        yield { type: "error", content: "Please configure your LLM provider in settings." };
        return;
      }

      setIsStreaming(true);
      setError(null);

      try {
        const response = await fetch("/api/llm/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, depth }),
        });

        if (!response.ok) {
          throw new Error("Failed to start research generation");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                yield { type: "done", content: "" };
              } else {
                try {
                  const parsed = JSON.parse(data);
                  yield parsed;
                } catch (e) {
                  // Log parse failure for debugging, but continue processing
                  console.error("[useLLM] Failed to parse research response:", data, e);
                  // If it looks like text content, yield it as text
                  if (data && !data.startsWith("{") && !data.startsWith("[")) {
                    yield { type: "text", content: data };
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        const message = (err as Error).message;
        console.error("[useLLM] Research stream error:", message);
        setError(message);
        yield { type: "error", content: message };
      } finally {
        setIsStreaming(false);
      }
    },
    [hasValidLLMConfig]
  );

  const streamContent = useCallback(
    async function* (
      research: string,
      format: "presentation" | "tutorial" | "explainer",
      targetLength: number
    ): AsyncGenerator<StreamingMessage> {
      if (!hasValidLLMConfig()) {
        yield { type: "error", content: "Please configure your LLM provider in settings." };
        return;
      }

      setIsStreaming(true);
      setError(null);

      try {
        const response = await fetch("/api/llm/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ research, format, targetLength }),
        });

        if (!response.ok) {
          throw new Error("Failed to start content generation");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                yield { type: "done", content: "" };
              } else {
                try {
                  const parsed = JSON.parse(data);
                  yield parsed;
                } catch (e) {
                  // Log parse failure for debugging, but continue processing
                  console.error("[useLLM] Failed to parse content response:", data, e);
                  // If it looks like text content, yield it as text
                  if (data && !data.startsWith("{") && !data.startsWith("[")) {
                    yield { type: "text", content: data };
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        const message = (err as Error).message;
        console.error("[useLLM] Content stream error:", message);
        setError(message);
        yield { type: "error", content: message };
      } finally {
        setIsStreaming(false);
      }
    },
    [hasValidLLMConfig]
  );

  const streamScript = useCallback(
    async function* (
      slideContent: string,
      slideIndex: number
    ): AsyncGenerator<StreamingMessage> {
      if (!hasValidLLMConfig()) {
        yield { type: "error", content: "Please configure your LLM provider in settings." };
        return;
      }

      setIsStreaming(true);
      setError(null);

      try {
        const response = await fetch("/api/llm/script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slideContent, slideIndex }),
        });

        if (!response.ok) {
          throw new Error("Failed to start script generation");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                yield { type: "done", content: "" };
              } else {
                try {
                  const parsed = JSON.parse(data);
                  yield parsed;
                } catch (e) {
                  // Log parse failure for debugging, but continue processing
                  console.error("[useLLM] Failed to parse script response:", data, e);
                  // If it looks like text content, yield it as text
                  if (data && !data.startsWith("{") && !data.startsWith("[")) {
                    yield { type: "text", content: data };
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        const message = (err as Error).message;
        console.error("[useLLM] Script stream error:", message);
        setError(message);
        yield { type: "error", content: message };
      } finally {
        setIsStreaming(false);
      }
    },
    [hasValidLLMConfig]
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
