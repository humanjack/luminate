// Deterministic clarity score that turns the per-recording analysis
// data (filler words, waveform amplitudes) into a single 0-100 number
// the UI can rank and graph.
//
// Two signals:
//   - filler density (fillers per 100 spoken words)
//   - long-silence ratio (fraction of total time spent above the
//     silence threshold but with no signal)

export interface FillerEntry {
  word: string;
  count: number;
  timestamps?: number[];
}

export interface ClarityInput {
  scriptText: string | null | undefined;
  fillerWords: FillerEntry[] | null | undefined;
  waveform?: number[] | null | undefined;
  durationSec?: number | null | undefined;
  // amplitude (0-1) below which a sample counts as silence
  silenceThreshold?: number;
  // contiguous silence shorter than this is normal speech rhythm
  minLongSilenceSec?: number;
}

export interface ClarityBreakdown {
  score: number;                  // 0-100
  fillersPer100Words: number;
  longSilenceRatio: number;       // 0-1
  totalFillers: number;
  wordCount: number;
}

export function computeClarity(input: ClarityInput): ClarityBreakdown {
  const text = (input.scriptText ?? "").trim();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const totalFillers =
    (input.fillerWords ?? []).reduce((acc, f) => acc + (f.count || 0), 0) || 0;

  const fillersPer100Words =
    wordCount === 0 ? 0 : (totalFillers / wordCount) * 100;

  const longSilenceRatio = computeLongSilenceRatio(input);

  // Calibrated so:
  //   - 0 fillers / no long silence → 100
  //   - 10 fillers / 100 words → ~80
  //   - 25 fillers / 100 words → ~50
  //   - 50% long silence → -20 alone
  const raw = 100 - fillersPer100Words * 2 - longSilenceRatio * 40;

  return {
    score: Math.max(0, Math.min(100, Math.round(raw))),
    fillersPer100Words: Math.round(fillersPer100Words * 10) / 10,
    longSilenceRatio: Math.round(longSilenceRatio * 1000) / 1000,
    totalFillers,
    wordCount,
  };
}

function computeLongSilenceRatio(input: ClarityInput): number {
  const w = input.waveform;
  if (!w || w.length === 0) return 0;

  const totalSec = input.durationSec ?? 0;
  if (totalSec <= 0) return 0;

  const samplesPerSec = w.length / totalSec;
  if (!Number.isFinite(samplesPerSec) || samplesPerSec <= 0) return 0;

  const threshold = input.silenceThreshold ?? 0.05;
  const minLongSilenceSec = input.minLongSilenceSec ?? 0.8;
  const minLongSilenceSamples = Math.max(
    1,
    Math.floor(minLongSilenceSec * samplesPerSec)
  );

  let longSilenceSamples = 0;
  let run = 0;
  for (const sample of w) {
    if (Math.abs(sample) < threshold) {
      run++;
    } else {
      if (run >= minLongSilenceSamples) longSilenceSamples += run;
      run = 0;
    }
  }
  if (run >= minLongSilenceSamples) longSilenceSamples += run;

  return Math.min(1, longSilenceSamples / w.length);
}

const FILLER_SPLIT_RE = /([\s.,;!?]+)/;

/**
 * Mark each filler-word occurrence inside the script with `<mark data-filler>…</mark>`
 * so the practice panel can highlight them. Pure HTML transformation —
 * caller is responsible for wrapping the surrounding text in a safe React
 * `dangerouslySetInnerHTML` payload (we escape the input here).
 */
export function highlightFillers(
  scriptText: string,
  fillerWords: FillerEntry[]
): string {
  if (!scriptText) return "";

  const targets = new Set(
    fillerWords
      .map((f) => f.word?.toLowerCase().trim())
      .filter((w): w is string => !!w)
  );

  const tokens = scriptText.split(FILLER_SPLIT_RE);
  const counts = new Map<string, number>(
    fillerWords.map((f) => [f.word.toLowerCase().trim(), f.count])
  );

  return tokens
    .map((token) => {
      const lower = token.toLowerCase().trim();
      const safe = escapeHtml(token);
      if (!lower || !targets.has(lower)) return safe;
      const count = counts.get(lower) ?? 1;
      return `<mark data-filler="${escapeHtml(lower)}" data-count="${count}" class="bg-rose-200/80 dark:bg-rose-900/70 text-rose-900 dark:text-rose-100 rounded px-0.5">${safe}</mark>`;
    })
    .join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
