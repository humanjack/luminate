/**
 * Grounded research generator (Phase 1, #45).
 *
 * Runs research generation in-process with the Anthropic SDK, attaching the
 * native web_search tool so the model grounds claims in real, retrieved
 * sources. Streams text deltas, then emits the parsed real sources once the
 * model finishes (handling the server-tool `pause_turn` continuation loop).
 *
 * Server-only (imports the Anthropic SDK). Kept separate from `generate.ts` so
 * the pure gate/resolver helpers there stay SDK-free and cheap to import.
 */
import Anthropic from "@anthropic-ai/sdk";

import {
  GROUNDED_RESEARCH_SYSTEM_PROMPT,
  getGroundedResearchPrompt,
} from "@/lib/llm/prompts";
import { ResearchDepth, ResearchEvent, ResearchGenerationConfig, resolveSearchProvider } from "./generate";

const MAX_TOKENS_BY_DEPTH: Record<ResearchDepth, number> = {
  quick: 2048,
  detailed: 4096,
  comprehensive: 8192,
};

// Safety bound on server-tool continuation turns (pause_turn loop).
const MAX_TURNS = 8;

export async function* generateGroundedResearch(
  config: ResearchGenerationConfig,
  topic: string,
  depth: ResearchDepth,
): AsyncGenerator<ResearchEvent> {
  if (!config.anthropicApiKey) {
    yield {
      type: "error",
      content:
        "Grounded research needs an Anthropic API key. Add it in Settings → API Keys.",
    };
    return;
  }

  const provider = resolveSearchProvider(config);
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const model = config.model || "claude-sonnet-4-6";
  const tools = provider.getToolDefinitions() as Anthropic.Messages.ToolUnion[];

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: getGroundedResearchPrompt(topic, depth) },
  ];

  const collectedContent: unknown[] = [];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const stream = client.messages.stream({
        model,
        max_tokens: MAX_TOKENS_BY_DEPTH[depth],
        system: GROUNDED_RESEARCH_SYSTEM_PROMPT,
        messages,
        tools,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "text", content: event.delta.text };
        }
      }

      const final = await stream.finalMessage();
      collectedContent.push(...final.content);

      // Server-side tool loop: pause_turn means "resume" — re-send with the
      // assistant turn appended and let the server continue.
      if (final.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: final.content });
        continue;
      }
      break;
    }

    yield { type: "sources", sources: provider.extractSources(collectedContent) };
    yield { type: "done" };
  } catch (err) {
    yield { type: "error", content: (err as Error).message };
  }
}
