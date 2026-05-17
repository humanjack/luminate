// Validate + sanitize LLM-suggested clip ranges.
// Clip rules: 15s ≤ duration ≤ 60s, inside the total video, no overlaps
// (later suggestions get nudged or dropped).

export interface RawClip {
  startSec?: unknown;
  endSec?: unknown;
  hook?: unknown;
  viralityScore?: unknown;
  reasoning?: unknown;
}

export interface ValidClip {
  startSec: number;
  endSec: number;
  hook: string;
  viralityScore: number;
  reasoning: string;
}

const MIN_DURATION = 15;
const MAX_DURATION = 60;

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function sanitizeClips(
  raw: unknown,
  totalDurationSec: number
): ValidClip[] {
  const list = Array.isArray(raw) ? raw : [];
  const accepted: ValidClip[] = [];

  for (const r of list as RawClip[]) {
    const hook = asString(r.hook);
    const reasoning = asString(r.reasoning) || "No reasoning provided.";
    const score = Math.round(clamp(asNumber(r.viralityScore), 0, 100));

    let start = asNumber(r.startSec);
    let end = asNumber(r.endSec);

    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (!hook) continue;

    // Normalise direction
    if (end < start) [start, end] = [end, start];

    // Clamp inside the actual video
    start = clamp(start, 0, Math.max(0, totalDurationSec - MIN_DURATION));
    end = clamp(end, start + MIN_DURATION, totalDurationSec);

    let duration = end - start;
    if (duration < MIN_DURATION) {
      end = Math.min(totalDurationSec, start + MIN_DURATION);
      duration = end - start;
    }
    if (duration > MAX_DURATION) {
      end = start + MAX_DURATION;
      duration = MAX_DURATION;
    }
    if (duration < MIN_DURATION) continue; // video too short to fit

    // Drop strict duplicates and heavy overlaps with already-accepted clips.
    const overlaps = accepted.some((a) => {
      const overlap = Math.max(0, Math.min(end, a.endSec) - Math.max(start, a.startSec));
      const minDur = Math.min(end - start, a.endSec - a.startSec);
      return overlap / minDur > 0.5;
    });
    if (overlaps) continue;

    accepted.push({
      startSec: Number(start.toFixed(2)),
      endSec: Number(end.toFixed(2)),
      hook: hook.slice(0, 140),
      viralityScore: score,
      reasoning: reasoning.slice(0, 280),
    });

    if (accepted.length >= 6) break;
  }

  // Highest-score first for the UI
  accepted.sort((a, b) => b.viralityScore - a.viralityScore);
  return accepted;
}
