import { NextRequest } from "next/server";

import { generationResponse } from "@/lib/llm/generate";
import { RESEARCH_SYSTEM_PROMPT, getResearchPrompt } from "@/lib/llm/prompts";
import { loadResearchGenerationConfig } from "@/lib/research/config";
import { shouldUseInProcessResearch } from "@/lib/research/generate";
import { generateAgenticResearch } from "@/lib/research/loop";
import { parseJson } from "@/lib/api/validate";
import { researchGenerateSchema } from "@/lib/api/schemas";
import { rateLimited, LLM_CALL_LIMIT } from "@/lib/net/rateLimit";

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
 * text + real sources (Phase 1, #45). Otherwise it uses the selected provider directly in Next.js.
 */
export async function POST(request: NextRequest) {
  const limited = rateLimited(request, "llm-research", LLM_CALL_LIMIT);
  if (limited) return limited;

  const parsed = await parseJson(request, researchGenerateSchema);
  if (!parsed.ok) return parsed.response;
  const { topic, depth } = parsed.data;

  const config = await loadResearchGenerationConfig();

  if (shouldUseInProcessResearch(config)) {
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

  return generationResponse(request, RESEARCH_SYSTEM_PROMPT, getResearchPrompt(topic, depth), 8192);
}
