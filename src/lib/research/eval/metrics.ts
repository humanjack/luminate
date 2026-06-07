/**
 * Cheap automatic eval metrics (Phase 5, #49).
 *
 * These don't need an LLM judge — they're computed directly from a generated
 * brief and its sources, so they're suitable as fast CI regression signals
 * (e.g. fail if the grounded-claim ratio drops below a floor).
 */
import { extractSourcesFromContent } from "../sources";

const MD_LINK = /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g;
const PLACEHOLDER_HINTS = ["example.com", "placeholder", "url-here", "your-source", "todo"];

export interface BriefMetrics {
  /** Distinct real inline citation URLs in the markdown. */
  citationCount: number;
  /** Citations that look like placeholders (lower is better). */
  placeholderCount: number;
  /** citationCount / (top-level bullet lines) — rough grounding density. */
  groundedRatio: number;
  bulletCount: number;
}

function isPlaceholder(url: string): boolean {
  const u = url.toLowerCase();
  return PLACEHOLDER_HINTS.some((h) => u.includes(h));
}

/** Count distinct inline citation URLs and how many look like placeholders. */
export function citationStats(markdown: string): { urls: string[]; placeholders: string[] } {
  const urls = new Set<string>();
  const placeholders = new Set<string>();
  for (const m of markdown.matchAll(MD_LINK)) {
    const url = m[1];
    urls.add(url);
    if (isPlaceholder(url)) placeholders.add(url);
  }
  return { urls: [...urls], placeholders: [...placeholders] };
}

function countTopLevelBullets(markdown: string): number {
  return markdown.split("\n").filter((l) => /^\s*[-*]\s+\S/.test(l)).length;
}

export function briefMetrics(markdown: string): BriefMetrics {
  const { urls, placeholders } = citationStats(markdown);
  const bulletCount = countTopLevelBullets(markdown);
  return {
    citationCount: urls.length,
    placeholderCount: placeholders.length,
    bulletCount,
    groundedRatio: bulletCount === 0 ? 0 : Math.min(1, urls.length / bulletCount),
  };
}

/** Convenience: count real sources surfaced in a model message's content blocks. */
export function sourceCountFromContent(content: unknown): number {
  return extractSourcesFromContent(content).length;
}
