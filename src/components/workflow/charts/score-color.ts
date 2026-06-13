/**
 * Shared score → color/label mapping for the analysis & readiness charts.
 * Kept framework-agnostic (pure functions + token maps) so it can be unit
 * tested and reused by RadialScore, RadarChart and the readiness meter.
 */

export type ScoreTone = "good" | "ok" | "bad";

/** Color band thresholds mirror the analysis page's original getScoreColor. */
export function scoreTone(value: number): ScoreTone {
  if (value >= 90) return "good";
  if (value >= 75) return "ok";
  return "bad";
}

/** Raw hex for SVG stroke/fill (readable in both light and dark themes). */
export const TONE_STROKE: Record<ScoreTone, string> = {
  good: "#10b981", // emerald-500
  ok: "#f59e0b", // amber-500
  bad: "#ef4444", // red-500
};

/** Tailwind text-color class for numbers/labels. */
export const TONE_TEXT: Record<ScoreTone, string> = {
  good: "text-emerald-500",
  ok: "text-amber-500",
  bad: "text-red-500",
};

/** Human label for an overall score (matches the original page semantics). */
export function scoreLabel(value: number): string {
  if (value >= 90) return "Excellent";
  if (value >= 80) return "Good";
  if (value >= 70) return "Fair";
  return "Needs Work";
}
