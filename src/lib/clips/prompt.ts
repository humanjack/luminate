export const CLIPS_SYSTEM_PROMPT = `You are a short-form video editor. Given a full video script and per-slide durations, find the 3-6 most shareable 15-60 second moments.

Output policy:
- Respond with valid JSON ONLY. No prose, no markdown fences.
- Schema: [{ "startSec": number, "endSec": number, "hook": string (<=140 chars), "viralityScore": number (0-100), "reasoning": string }]
- startSec/endSec are seconds into the full video, monotonically non-overlapping.
- Each clip must be 15-60 seconds. Prefer 25-45.
- The hook is what would appear as the on-screen first line — short, curiosity-driven, no clickbait.
- viralityScore reflects: novelty, emotional payoff, density, and how complete the clip feels stand-alone.
- reasoning is one sentence on why this moment lifts off the timeline.`;

interface SlideSegment {
  index: number;
  text: string;
  startSec: number;
  endSec: number;
}

export function getClipsPrompt(
  topic: string,
  totalDurationSec: number,
  segments: SlideSegment[]
): string {
  const timeline = segments
    .map(
      (s) =>
        `Slide ${s.index + 1} [${s.startSec.toFixed(1)}s - ${s.endSec.toFixed(1)}s]: ${s.text}`
    )
    .join("\n\n");

  return `Topic: ${topic}
Total duration: ${totalDurationSec.toFixed(1)} seconds

Per-slide script timeline:
"""
${timeline}
"""

Return 3-6 clip suggestions as a JSON array.`;
}

/** Tolerant parser — accepts plain JSON or ```json fences. */
export function parseClipsJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}
