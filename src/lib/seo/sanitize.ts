import { combineScores, scoreTitle } from "./ctrScore";
import { buildTimestamps, type ScriptForTimestamp, type SlideForTimestamp } from "./timestamps";

export interface SanitizedSeoOutput {
  titles: Array<{ text: string; ctrScore: number; reasoning: string }>;
  description: string;
  tags: string[];
}

interface RawSeoCandidate {
  text?: unknown;
  title?: unknown;
  ctrScore?: unknown;
  score?: unknown;
  reasoning?: unknown;
}

interface RawSeoOutput {
  titles?: unknown;
  description?: unknown;
  tags?: unknown;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 50;
}

/**
 * Validate + enrich raw LLM JSON.
 * - Drops malformed titles, keeps up to 5
 * - Combines LLM-judged CTR with deterministic heuristic
 * - Substitutes the description's "{TIMESTAMPS}" marker with real chapter lines
 * - Deduplicates and lowercases tags, max 30
 */
export function sanitizeSeoOutput(
  raw: unknown,
  context: {
    slides: SlideForTimestamp[];
    scripts: ScriptForTimestamp[];
  }
): SanitizedSeoOutput {
  const obj = (raw ?? {}) as RawSeoOutput;

  const rawTitles = Array.isArray(obj.titles) ? (obj.titles as RawSeoCandidate[]) : [];
  const titles = rawTitles
    .map((t) => {
      const text = asString(t.text ?? t.title);
      const reasoning = asString(t.reasoning) || "No reasoning provided.";
      const llmScore = asNumber(t.ctrScore ?? t.score);
      const heuristicScore = scoreTitle(text);
      return text ? { text, reasoning, ctrScore: combineScores(llmScore, heuristicScore) } : null;
    })
    .filter((t): t is { text: string; ctrScore: number; reasoning: string } => !!t)
    .slice(0, 5);

  const timestamps = buildTimestamps(context.slides, context.scripts);
  let description = asString(obj.description);
  if (description.includes("{TIMESTAMPS}")) {
    description = description.replace("{TIMESTAMPS}", timestamps.join("\n"));
  } else if (timestamps.length > 0) {
    description = `${description}\n\nChapters:\n${timestamps.join("\n")}`;
  }

  const rawTags = Array.isArray(obj.tags) ? (obj.tags as unknown[]) : [];
  const tagSet = new Set<string>();
  for (const t of rawTags) {
    const tag = asString(t).replace(/^#/, "").toLowerCase();
    if (tag) tagSet.add(tag);
    if (tagSet.size >= 30) break;
  }

  return { titles, description, tags: [...tagSet] };
}
