/**
 * LLM-as-judge rubric for research quality (Phase 5, #49).
 *
 * Scores a generated research brief 1–5 on five dimensions (the standard
 * deep-research rubric: factual accuracy, citation accuracy, completeness,
 * source quality, readability). Prompt building, score parsing, and
 * aggregation are pure and unit-tested; the actual judge call lives in the
 * runner so this module stays SDK-free and importable from tests.
 */

export const RUBRIC_DIMENSIONS = [
  "factualAccuracy",
  "citationAccuracy",
  "completeness",
  "sourceQuality",
  "readability",
] as const;

export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];

export type RubricScores = Record<RubricDimension, number> & { notes?: string };

export function buildJudgePrompt(topic: string, brief: string): string {
  return `You are evaluating a research brief for a YouTube video on "${topic}".

Score it 1–5 (5 = excellent) on each dimension:
- factualAccuracy: are the claims correct?
- citationAccuracy: do the inline [title](url) citations actually support their claims, and are the URLs real?
- completeness: does it cover the topic's important angles?
- sourceQuality: are sources authoritative/primary rather than low-quality?
- readability: is it clear and suitable for narration?

Brief:
"""
${brief.slice(0, 24000)}
"""

Respond with ONLY a JSON object, no prose, no code fence:
{"factualAccuracy":N,"citationAccuracy":N,"completeness":N,"sourceQuality":N,"readability":N,"notes":"<one line>"}`;
}

function clampScore(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, n));
}

/** Tolerant parse of the judge's JSON object. Returns null if unusable. */
export function parseRubricScores(text: string): RubricScores | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const candidate = start !== -1 && end > start ? text.slice(start, end + 1) : text;

  let obj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== "object") return null;
    obj = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const scores = {} as RubricScores;
  for (const dim of RUBRIC_DIMENSIONS) {
    const v = clampScore(obj[dim]);
    if (v === null) return null; // require every dimension
    scores[dim] = v;
  }
  if (typeof obj.notes === "string") scores.notes = obj.notes;
  return scores;
}

export interface AggregateScores {
  perDimension: Record<RubricDimension, number>;
  overall: number;
  count: number;
}

/** Average each dimension across runs + the grand mean. */
export function aggregateScores(results: RubricScores[]): AggregateScores {
  const perDimension = {} as Record<RubricDimension, number>;
  if (results.length === 0) {
    for (const dim of RUBRIC_DIMENSIONS) perDimension[dim] = 0;
    return { perDimension, overall: 0, count: 0 };
  }
  let grandTotal = 0;
  for (const dim of RUBRIC_DIMENSIONS) {
    const sum = results.reduce((acc, r) => acc + r[dim], 0);
    perDimension[dim] = sum / results.length;
    grandTotal += perDimension[dim];
  }
  return {
    perDimension,
    overall: grandTotal / RUBRIC_DIMENSIONS.length,
    count: results.length,
  };
}
