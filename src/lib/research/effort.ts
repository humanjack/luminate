/**
 * Depth → effort mapping (Phase 2, #46).
 *
 * Depth stops being just a word-count instruction: it scales the agentic
 * loop's breadth (sub-questions), depth (follow-up iterations), source budget,
 * and output size. `maxSearchIterations` from settings caps the iteration count
 * so users keep a hard bound (more searching past a point reduces accuracy).
 */
import { ResearchDepth } from "./generate";

export interface ResearchEffort {
  /** How many sub-questions to decompose the topic into. */
  subQuestions: number;
  /** Max follow-up search rounds after the first pass. */
  iterations: number;
  /** Upper bound on sources retained. */
  maxSources: number;
  /** Output token budget for synthesis. */
  maxTokens: number;
}

const BY_DEPTH: Record<ResearchDepth, ResearchEffort> = {
  quick: { subQuestions: 3, iterations: 1, maxSources: 5, maxTokens: 2048 },
  detailed: { subQuestions: 5, iterations: 2, maxSources: 8, maxTokens: 4096 },
  comprehensive: { subQuestions: 8, iterations: 3, maxSources: 14, maxTokens: 8192 },
};

export function researchEffort(
  depth: ResearchDepth,
  opts?: { maxSources?: number; maxSearchIterations?: number },
): ResearchEffort {
  const base = BY_DEPTH[depth] ?? BY_DEPTH.detailed;
  return {
    ...base,
    // Settings act as hard caps over the depth defaults.
    maxSources: Math.min(base.maxSources, opts?.maxSources ?? base.maxSources),
    iterations: Math.min(base.iterations, opts?.maxSearchIterations ?? base.iterations),
  };
}

/** Hard ceiling on a single research run's web_search tool budget. */
export const MAX_SEARCH_BUDGET = 20;

/**
 * Total web-search budget (tool `max_uses`) for the agentic run: roughly one
 * search per sub-question per iteration round, bounded by MAX_SEARCH_BUDGET.
 * For native web search the model runs its own tool loop within this budget,
 * so `iterations` scales how deep it can dig rather than spawning extra calls.
 */
export function computeSearchBudget(subQuestionCount: number, iterations: number): number {
  const budget = Math.max(1, subQuestionCount) * Math.max(1, iterations + 1);
  return Math.min(MAX_SEARCH_BUDGET, budget);
}
