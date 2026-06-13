/**
 * Agentic research loop (Phase 2, #46): plan → search → synthesize → rank.
 *
 *   1. Decompose the topic into focused sub-questions (plan).
 *   2. Run a grounded synthesis pass guided by that plan, with the web_search
 *      tool budget scaled to the effort (the native model runs its own
 *      search→read→reflect loop within that budget).
 *   3. Dedupe + credibility-rank the gathered sources and cap to the budget.
 *
 * Emits `progress` labels for each phase, streams the draft as `text`, and ends
 * with the ranked `sources`. Supersedes the single-pass generator when web
 * research is enabled. Native (Anthropic) provider only for now; the search-api
 * orchestration (Tavily/Brave) lands when those providers are implemented.
 */
import Anthropic from "@anthropic-ai/sdk";

import { GROUNDED_RESEARCH_SYSTEM_PROMPT, getAgenticResearchPrompt } from "@/lib/llm/prompts";
import { computeSearchBudget, researchEffort } from "./effort";
import {
  ResearchDepth,
  ResearchEvent,
  ResearchGenerationConfig,
  resolveSearchProvider,
} from "./generate";
import { streamGroundedTurns } from "./generate-grounded";
import { planResearch } from "./plan";
import { dedupeAndRankSources } from "./rank";
import { AnthropicSearchProvider } from "./search";

export async function* generateAgenticResearch(
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
  if (provider.mode !== "native-tool") {
    yield {
      type: "error",
      content: `The "${config.searchProvider}" provider isn't supported by the agentic loop yet — switch to the Anthropic provider in Settings → Research.`,
    };
    return;
  }

  const effort = researchEffort(depth, {
    maxSources: config.maxSources,
    maxSearchIterations: config.maxSearchIterations,
  });
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const model = config.model || "claude-sonnet-4-6";

  try {
    yield { type: "progress", label: `Planning ${effort.subQuestions} sub-questions…` };
    const subQuestions = await planResearch(client, model, topic, depth, effort.subQuestions);

    yield { type: "progress", label: `Researching across ${subQuestions.length} sub-questions…` };
    const searchBudget = computeSearchBudget(subQuestions.length, effort.iterations);
    const tools = new AnthropicSearchProvider(searchBudget).getToolDefinitions() as Anthropic.Messages.ToolUnion[];

    const collected = yield* streamGroundedTurns(
      client,
      model,
      GROUNDED_RESEARCH_SYSTEM_PROMPT,
      getAgenticResearchPrompt(topic, depth, subQuestions),
      tools,
      effort.maxTokens,
    );

    yield { type: "progress", label: "Ranking sources…" };
    const ranked = dedupeAndRankSources(provider.extractSources(collected), effort.maxSources);
    yield { type: "sources", sources: ranked };
    yield { type: "done" };
  } catch (err) {
    yield { type: "error", content: (err as Error).message };
  }
}
