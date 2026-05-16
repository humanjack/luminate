import type { Source } from "@/lib/db/schema";

export interface ExtractedClaim {
  text: string;
  sourceIds: string[];
}

/**
 * Extract candidate claims from generated research markdown.
 *
 * Strategy:
 * - Each top-level bullet (`- ...` / `* ...`) is treated as a candidate claim.
 * - Inline markdown links `[label](url)` are stripped and resolved to source
 *   ids when the URL matches one of `sources`. Unresolved links and bullets
 *   without any link land as unsupported claims (`sourceIds: []`).
 */
export function extractClaimsFromMarkdown(
  markdown: string,
  sources: Pick<Source, "id" | "url">[] = []
): ExtractedClaim[] {
  if (!markdown.trim()) return [];

  const urlToId = new Map<string, string>();
  for (const s of sources) {
    if (s.url) urlToId.set(s.url.trim(), s.id);
  }

  const lines = markdown.split(/\r?\n/);
  const claims: ExtractedClaim[] = [];

  for (const raw of lines) {
    const trimmed = raw.replace(/^\s+/, "");
    if (!/^[-*]\s+/.test(trimmed)) continue;
    const body = trimmed.replace(/^[-*]\s+/, "").trim();
    if (!body) continue;

    const sourceIds = new Set<string>();
    let cleaned = body;
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    cleaned = cleaned.replace(linkRegex, (_match, label: string, url: string) => {
      const id = urlToId.get(url.trim());
      if (id) sourceIds.add(id);
      return label;
    });

    claims.push({
      text: cleaned.trim(),
      sourceIds: Array.from(sourceIds),
    });
  }

  // De-duplicate identical claim text, merging source links
  const seen = new Map<string, ExtractedClaim>();
  for (const c of claims) {
    const existing = seen.get(c.text);
    if (existing) {
      for (const id of c.sourceIds) {
        if (!existing.sourceIds.includes(id)) existing.sourceIds.push(id);
      }
    } else {
      seen.set(c.text, { ...c });
    }
  }
  return Array.from(seen.values());
}
