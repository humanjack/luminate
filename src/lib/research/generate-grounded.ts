/**
 * Grounded research generation primitives (Phase 1 #45, reused by Phase 2 #46).
 *
 * Runs research generation in-process with the Anthropic SDK, attaching the
 * native web_search tool so the model grounds claims in real, retrieved
 * sources. `streamGroundedTurns` is the reusable building block: it streams
 * text events and *returns* (via `yield*`) the collected content blocks for
 * source extraction, handling the server-tool `pause_turn` continuation loop.
 *
 * Server-only (imports the Anthropic SDK). Kept separate from `generate.ts` so
 * the pure gate/resolver helpers there stay SDK-free and cheap to import.
 */
import Anthropic from "@anthropic-ai/sdk";

import {
  GROUNDED_RESEARCH_SYSTEM_PROMPT,
  getGroundedResearchPrompt,
} from "@/lib/llm/prompts";
import {
  ResearchDepth,
  ResearchEvent,
  ResearchGenerationConfig,
  resolveSearchProvider,
} from "./generate";

export const MAX_TOKENS_BY_DEPTH: Record<ResearchDepth, number> = {
  quick: 2048,
  detailed: 4096,
  comprehensive: 8192,
};

// Safety bound on server-tool continuation turns (pause_turn loop).
const MAX_TURNS = 8;

/**
 * Stream one grounded "turn" (which may span several server-tool continuations
 * via pause_turn). Yields `text` events as deltas arrive and RETURNS the
 * collected content blocks across all continuations (consume via `yield*`).
 */
export async function* streamGroundedTurns(
  client: Anthropic,
  model: string,
  system: string,
  userPrompt: string,
  tools: Anthropic.Messages.ToolUnion[],
  maxTokens: number,
): AsyncGenerator<ResearchEvent, unknown[]> {
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];
  const collected: unknown[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = client.messages.stream({ model, max_tokens: maxTokens, system, messages, tools });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "text", content: event.delta.text };
      }
    }

    const final = await stream.finalMessage();
    collected.push(...final.content);

    if (final.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: final.content });
      continue;
    }
    break;
  }

  return collected;
}

/** Single-pass grounded research (Phase 1). The agentic loop (#46) supersedes
 * this when enabled, but it remains the simplest grounded entry point. */
export async function* generateGroundedResearch(
  config: ResearchGenerationConfig,
  topic: string,
  depth: ResearchDepth,
): AsyncGenerator<ResearchEvent> {
  if (!config.anthropicApiKey) {
    yield {
      type: "error",
      content: "Grounded research needs an Anthropic API key. Add it in Settings → API Keys.",
    };
    return;
  }

  const provider = resolveSearchProvider(config);
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const model = config.model || "claude-sonnet-4-6";
  const tools = provider.getToolDefinitions() as Anthropic.Messages.ToolUnion[];

  try {
    const collected = yield* streamGroundedTurns(
      client,
      model,
      GROUNDED_RESEARCH_SYSTEM_PROMPT,
      getGroundedResearchPrompt(topic, depth),
      tools,
      MAX_TOKENS_BY_DEPTH[depth],
    );
    yield { type: "sources", sources: provider.extractSources(collected) };
    yield { type: "done" };
  } catch (err) {
    yield { type: "error", content: (err as Error).message };
  }
}
