export interface ScriptForTimestamp {
  slideIndex: number;
  text?: string | null;
  estimatedDuration?: number | null;
}

export interface SlideForTimestamp {
  index: number;
  markdown: string;
}

function formatTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function extractTitle(markdown: string, fallback: string): string {
  const headingMatch = markdown.match(/^#+\s+(.+)$/m);
  return (headingMatch ? headingMatch[1] : fallback).trim();
}

/**
 * Build YouTube-friendly timestamp lines from per-slide scripts and slides.
 * First chapter must be 0:00 per YouTube's chapter spec.
 */
export function buildTimestamps(
  slides: SlideForTimestamp[],
  scripts: ScriptForTimestamp[]
): string[] {
  if (slides.length === 0) return [];

  const byIndex = new Map(scripts.map((s) => [s.slideIndex, s]));
  const lines: string[] = [];
  let offset = 0;

  const ordered = [...slides].sort((a, b) => a.index - b.index);

  ordered.forEach((slide, i) => {
    const title = extractTitle(slide.markdown, `Slide ${slide.index + 1}`);
    const stamp = i === 0 ? "0:00" : formatTimestamp(offset);
    lines.push(`${stamp} ${title}`);
    const dur = byIndex.get(slide.index)?.estimatedDuration ?? 30;
    offset += Math.max(1, dur);
  });

  return lines;
}
