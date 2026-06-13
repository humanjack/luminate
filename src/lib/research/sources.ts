/**
 * Extract real sources from an Anthropic message that used the web_search tool
 * (Phase 1, #45).
 *
 * Two places carry source URLs in a web-search response:
 *   1. `web_search_tool_result` blocks → `content[]` of `web_search_result`
 *      items ({ title, url, page_age }). These are everything the search
 *      surfaced.
 *   2. `text` blocks → `citations[]` of `web_search_result_location`
 *      ({ url, title, cited_text }). These are the sources the model actually
 *      cited inline, and they carry the quoted snippet we reuse in Phase 3.
 *
 * We merge both, preferring a cited snippet when present, and dedupe by URL.
 * Typed loosely (`unknown`) so this stays decoupled from a specific SDK version
 * and easy to unit-test with plain fixtures.
 */
import { SearchResult } from "./search/types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function extractSourcesFromContent(content: unknown): SearchResult[] {
  if (!Array.isArray(content)) return [];

  const byUrl = new Map<string, SearchResult>();

  const add = (url?: string, title?: string, snippet?: string) => {
    if (!url) return;
    const existing = byUrl.get(url);
    if (existing) {
      // Enrich: keep first title, fill snippet if we now have one.
      if (!existing.snippet && snippet) existing.snippet = snippet;
      if (!existing.title && title) existing.title = title;
      return;
    }
    byUrl.set(url, { url, title: title ?? url, snippet });
  };

  for (const rawBlock of content) {
    const block = asRecord(rawBlock);
    if (!block) continue;

    // 1. web_search_tool_result blocks
    if (block.type === "web_search_tool_result") {
      const results = block.content;
      if (Array.isArray(results)) {
        for (const rawItem of results) {
          const item = asRecord(rawItem);
          if (item && item.type === "web_search_result") {
            add(str(item.url), str(item.title));
          }
        }
      }
      continue;
    }

    // 2. citations on text blocks
    if (block.type === "text" && Array.isArray(block.citations)) {
      for (const rawCite of block.citations) {
        const cite = asRecord(rawCite);
        if (cite && cite.type === "web_search_result_location") {
          add(str(cite.url), str(cite.title), str(cite.cited_text));
        }
      }
    }
  }

  return Array.from(byUrl.values());
}
