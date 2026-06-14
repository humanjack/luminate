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
import { createAnthropicClient } from "@/lib/llm/anthropicClient";

import {
  GROUNDED_RESEARCH_SYSTEM_PROMPT,
  SYNTHESIS_SYSTEM_PROMPT,
  getAgenticResearchPrompt,
  getSynthesisPrompt,
} from "@/lib/llm/prompts";
import { planFanout, routeResearchStrategy } from "./complexity";
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
import { runSubagent } from "./subagent";
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
  const client = createAnthropicClient(config.anthropicApiKey);
  const model = config.model || "claude-sonnet-4-6";
  const strategy = routeResearchStrategy(depth);

  try {
    yield { type: "progress", label: `Planning ${effort.subQuestions} sub-questions…` };
    const subQuestions = await planResearch(client, model, topic, depth, effort.subQuestions);

    if (strategy === "fanout") {
      yield* runFanout(client, model, topic, depth, subQuestions, effort, provider);
      return;
    }

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

/**
 * Multi-agent fan-out (Phase 4): one subagent per sub-question in parallel, then
 * a lead synthesis pass over their findings. Subagent sources are merged +
 * ranked. The lead synthesizes without its own search tool (it grounds in the
 * subagents' already-cited findings).
 */
async function* runFanout(
  client: Anthropic,
  model: string,
  topic: string,
  depth: ResearchDepth,
  subQuestions: string[],
  effort: ReturnType<typeof researchEffort>,
  provider: ReturnType<typeof resolveSearchProvider>,
): AsyncGenerator<ResearchEvent> {
  void provider; // sources come from the subagents directly
  const { count, dropped } = planFanout(subQuestions.length);
  const chosen = subQuestions.slice(0, count);

  yield {
    type: "progress",
    label:
      dropped > 0
        ? `Researching ${count} of ${subQuestions.length} sub-questions in parallel (capped)…`
        : `Researching ${count} sub-questions in parallel…`,
  };

  // Fan out; a failed subagent shouldn't sink the whole run.
  const settled = await Promise.allSettled(
    chosen.map((q) => runSubagent(client, model, topic, q)),
  );
  const results = settled
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof runSubagent>>> =>
      r.status === "fulfilled",
    )
    .map((r) => r.value);

  const failures = settled.filter((r) => r.status === "rejected");
  for (const f of failures) {
    console.error("[research] subagent failed:", (f as PromiseRejectedResult).reason);
  }

  if (results.length === 0) {
    yield { type: "error", content: "All research subagents failed. Try again or use a lower depth." };
    return;
  }

  yield { type: "progress", label: "Synthesizing findings…" };
  const collected = yield* streamGroundedTurns(
    client,
    model,
    SYNTHESIS_SYSTEM_PROMPT,
    getSynthesisPrompt(
      topic,
      depth,
      results.map((r) => ({ subQuestion: r.subQuestion, summary: r.summary })),
    ),
    [], // no web_search during synthesis — ground in the subagents' findings
    effort.maxTokens,
  );
  void collected;

  yield { type: "progress", label: "Ranking sources…" };
  const merged = results.flatMap((r) => r.sources);
  yield { type: "sources", sources: dedupeAndRankSources(merged, effort.maxSources) };
  yield { type: "done" };
}
