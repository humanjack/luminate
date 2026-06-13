import { NextRequest } from "next/server";

import { proxyLLMStream, jsonError } from "@/lib/llm/proxy";
import { loadResearchGenerationConfig } from "@/lib/research/config";
import { useInProcessResearch, type ResearchDepth } from "@/lib/research/generate";
import { generateAgenticResearch } from "@/lib/research/loop";

export const runtime = "nodejs";

const encoder = new TextEncoder();
function sse(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Research generation endpoint.
 *
 * When grounded web research is enabled (Settings → Research), generation runs
 * in-process via the Anthropic SDK with the native web_search tool, streaming
 * text + real sources (Phase 1, #45). Otherwise it falls back to proxying the
 * FastAPI backend (legacy single-prompt path).
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { topic } = body;
  const depth: ResearchDepth = body.depth || "detailed";

  if (!topic) {
    return jsonError("Topic is required", 400);
  }

  const config = await loadResearchGenerationConfig();

  if (useInProcessResearch(config)) {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of generateAgenticResearch(config, topic, depth)) {
            controller.enqueue(sse(event));
          }
        } catch (error) {
          controller.enqueue(sse({ type: "error", content: (error as Error).message }));
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Fallback: proxy to the FastAPI backend (legacy single-prompt path)
  return proxyLLMStream("/api/llm/research", { topic, depth }, "LLM Research");
}
