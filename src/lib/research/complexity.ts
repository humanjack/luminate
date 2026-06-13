/**
 * Scale-to-complexity routing (Phase 4, #48).
 *
 * Anthropic's multi-agent research lesson: match effort to the task or you
 * either under-serve hard queries or spawn a fleet of subagents for a trivial
 * one (multi-agent uses ~15x the tokens of a single chat turn). So:
 *   - quick        → single guided pass (no fan-out)
 *   - detailed     → agentic loop (one guided pass, model's own search loop)
 *   - comprehensive→ fan out to parallel subagents, one per sub-question
 *
 * Pure + unit-tested. The hard caps keep token cost bounded.
 */
import { ResearchDepth } from "./generate";

export type ResearchStrategy = "single" | "loop" | "fanout";

/** Never spawn more than this many subagents, regardless of sub-question count. */
export const MAX_SUBAGENTS = 6;

export function routeResearchStrategy(depth: ResearchDepth): ResearchStrategy {
  if (depth === "quick") return "single";
  if (depth === "comprehensive") return "fanout";
  return "loop";
}

/**
 * How many subagents to spawn for a fan-out run, and how many sub-questions get
 * dropped (so the caller can log it rather than silently truncating).
 */
export function planFanout(subQuestionCount: number): { count: number; dropped: number } {
  const count = Math.min(MAX_SUBAGENTS, Math.max(1, subQuestionCount));
  return { count, dropped: Math.max(0, subQuestionCount - count) };
}
