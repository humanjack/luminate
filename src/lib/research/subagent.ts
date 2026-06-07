/**
 * Research subagent worker (Phase 4, #48).
 *
 * Investigates a single sub-question end-to-end: grounded web search + a
 * concise sourced summary. Runs non-streaming (we fan these out in parallel and
 * only stream the lead's synthesis), draining the shared `streamGroundedTurns`
 * generator to collect text + source blocks. Low token budget per worker.
 */
import Anthropic from "@anthropic-ai/sdk";

import { SUBAGENT_SYSTEM_PROMPT, getSubagentPrompt } from "@/lib/llm/prompts";
import { streamGroundedTurns } from "./generate-grounded";
import { AnthropicSearchProvider, SearchResult } from "./search";

export interface SubagentResult {
  subQuestion: string;
  summary: string;
  sources: SearchResult[];
}

const SUBAGENT_MAX_TOKENS = 1500;
const SUBAGENT_SEARCH_BUDGET = 4;

export async function runSubagent(
  client: Anthropic,
  model: string,
  topic: string,
  subQuestion: string,
): Promise<SubagentResult> {
  const provider = new AnthropicSearchProvider(SUBAGENT_SEARCH_BUDGET);
  const tools = provider.getToolDefinitions() as Anthropic.Messages.ToolUnion[];

  const gen = streamGroundedTurns(
    client,
    model,
    SUBAGENT_SYSTEM_PROMPT,
    getSubagentPrompt(topic, subQuestion),
    tools,
    SUBAGENT_MAX_TOKENS,
  );

  let summary = "";
  let next = await gen.next();
  while (!next.done) {
    if (next.value.type === "text") summary += next.value.content;
    next = await gen.next();
  }
  const collected = next.value; // generator return value = collected content blocks

  return { subQuestion, summary, sources: provider.extractSources(collected) };
}
