/**
 * Source dedup + credibility ranking (Phase 2, #46).
 *
 * Pure helpers, no I/O. Dedupe by normalized URL, then rank so primary /
 * authoritative sources surface first, and cap to the effort's source budget.
 * "Primary" is a heuristic on the hostname TLD/known-publisher list — good
 * enough to bias synthesis toward better sources without a network call.
 */
import { SearchResult } from "./search/types";

const PRIMARY_TLDS = [".gov", ".edu", ".mil", ".int", ".ac.uk", ".gov.uk", ".edu.au"];
const PRIMARY_HOSTS = [
  "nature.com",
  "science.org",
  "who.int",
  "nasa.gov",
  "nih.gov",
  "arxiv.org",
  "ieee.org",
  "acm.org",
  "pubmed.ncbi.nlm.nih.gov",
];
const AGGREGATOR_HOSTS = [
  "medium.com",
  "quora.com",
  "reddit.com",
  "pinterest.com",
  "facebook.com",
  "x.com",
  "twitter.com",
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Normalize a URL for dedup: strip protocol case, trailing slash, fragment. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return url.trim();
  }
}

/** Higher score = more authoritative. */
export function credibilityScore(url: string): number {
  const host = hostOf(url);
  if (!host) return 0;
  if (PRIMARY_HOSTS.some((h) => host === h || host.endsWith("." + h))) return 3;
  if (PRIMARY_TLDS.some((t) => host.endsWith(t))) return 3;
  if (AGGREGATOR_HOSTS.some((h) => host === h || host.endsWith("." + h))) return -1;
  return 1;
}

export function dedupeAndRankSources(
  results: SearchResult[],
  maxSources: number,
): SearchResult[] {
  const byUrl = new Map<string, SearchResult>();
  for (const r of results) {
    if (!r.url) continue;
    const key = normalizeUrl(r.url);
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, { ...r });
    } else {
      if (!existing.snippet && r.snippet) existing.snippet = r.snippet;
      if ((!existing.title || existing.title === existing.url) && r.title) {
        existing.title = r.title;
      }
    }
  }

  // Rank by credibility desc; ties keep insertion order (stable via index).
  const ranked = Array.from(byUrl.values())
    .map((r, i) => ({ r, i, score: credibilityScore(r.url) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.r);

  return ranked.slice(0, Math.max(0, maxSources));
}
