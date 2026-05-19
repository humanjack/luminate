/**
 * Escape user-controlled text for inclusion inside SVG `<text>` content.
 * SVG is XML, so the same five rules as XML apply.
 *
 * NEVER skip this on user input — slide titles end up in the SVG, which
 * may later be served as an SVG file and rendered by the browser.
 */
export function escapeSvgText(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Naive word-wrap that fits roughly `maxCharsPerLine` per line and never exceeds `maxLines`. */
export function wrapLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let consumed = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) {
        consumed = i; // the current `word` was NOT pushed; leftover starts here
        break;
      }
    } else {
      current = candidate;
      consumed = i + 1;
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
    consumed = words.length;
  }

  if (lines.length === maxLines && consumed < words.length) {
    // Truncate the last line and ellipsize to signal "there's more"
    const last = lines[maxLines - 1];
    const budget = Math.max(1, maxCharsPerLine - 1);
    lines[maxLines - 1] =
      (last.length > budget ? last.slice(0, budget).trimEnd() : last) + "…";
  } else if (
    lines.length === maxLines &&
    lines[maxLines - 1].length > maxCharsPerLine
  ) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] =
      last.slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd() + "…";
  }

  return lines;
}

/**
 * Extract a single-digit or short numeric hook from a title, useful for
 * the "numbered-list" preset. Falls back to a sensible default.
 */
export function pickNumberHook(title: string, fallback = "7"): string {
  const match = title.match(/\b(\d{1,4})\b/);
  return match ? match[1] : fallback;
}
