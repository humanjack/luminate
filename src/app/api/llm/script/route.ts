import { NextRequest } from "next/server";
import { db, settings } from "@/lib/db";
import * as anthropicClient from "@/lib/llm/anthropic-client";
import * as claudeCli from "@/lib/llm/claude-cli";

export const runtime = "nodejs";

async function getSettings() {
  const allSettings = await db.select().from(settings);
  const settingsMap: Record<string, string> = {};
  for (const s of allSettings) {
    settingsMap[s.key] = s.value || "";
  }
  return settingsMap;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slideContent, slideIndex } = body;

  if (!slideContent) {
    return new Response(JSON.stringify({ error: "Slide content is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const settingsData = await getSettings();
  const provider = settingsData.llmProvider || "anthropic";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let generator: AsyncGenerator<{ type: string; content: string }>;

        if (provider === "anthropic") {
          const apiKey = settingsData.anthropicApiKey;
          const model = settingsData.claudeModel || "claude-sonnet-4-5-20250514";

          if (!apiKey) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", content: "Anthropic API key not configured" })}\n\n`)
            );
            controller.close();
            return;
          }

          generator = anthropicClient.streamScript(apiKey, model, slideContent, slideIndex);
        } else {
          generator = claudeCli.streamScript(slideContent, slideIndex);
        }

        for await (const message of generator) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
          );
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", content: (error as Error).message })}\n\n`)
        );
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
