// Parse Slidev-style markdown for a single slide into a structured Slide.
// Intentionally minimal: enough for the canvas to render reliably,
// nowhere near a full CommonMark parser.

export interface ParsedSlide {
  title: string | null;
  subtitle: string | null;
  bullets: string[];
  body: string[];            // non-bullet, non-code paragraphs
  code: { language: string | null; content: string } | null;
  speakerNotes: string | null;
  footer: string | null;     // last line if it looks like a citation/footer
}

const SPEAKER_NOTE_RE = /<!--\s*notes?\s*([\s\S]*?)-->/i;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const BULLET_RE = /^[-*]\s+(.+)$/;
const FENCE_OPEN_RE = /^```(\w+)?\s*$/;
const FENCE_CLOSE_RE = /^```\s*$/;

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) → label
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export function parseSlide(rawMarkdown: string): ParsedSlide {
  // Extract speaker notes (HTML comment), then strip ALL comments from the body.
  const noteMatch = rawMarkdown.match(SPEAKER_NOTE_RE);
  const speakerNotes = noteMatch?.[1]?.trim() || null;
  const cleaned = rawMarkdown.replace(COMMENT_RE, "");

  const lines = cleaned.split("\n");

  let title: string | null = null;
  let subtitle: string | null = null;
  const bullets: string[] = [];
  const body: string[] = [];
  let code: ParsedSlide["code"] = null;
  let inCode = false;
  let codeLang: string | null = null;
  const codeBuf: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (inCode) {
      if (FENCE_CLOSE_RE.test(line.trim())) {
        code = { language: codeLang, content: codeBuf.join("\n") };
        inCode = false;
        codeLang = null;
        codeBuf.length = 0;
      } else {
        codeBuf.push(rawLine);
      }
      continue;
    }

    const openMatch = line.trim().match(FENCE_OPEN_RE);
    if (openMatch && !inCode) {
      inCode = true;
      codeLang = openMatch[1] ?? null;
      continue;
    }

    if (!line.trim()) continue;

    const heading = line.match(HEADING_RE);
    if (heading) {
      const text = stripInlineMarkdown(heading[2]).trim();
      if (heading[1].length === 1 && title === null) {
        title = text;
      } else if (subtitle === null) {
        subtitle = text;
      } else {
        body.push(text);
      }
      continue;
    }

    const bullet = line.match(BULLET_RE);
    if (bullet) {
      bullets.push(stripInlineMarkdown(bullet[1].trim()));
      continue;
    }

    body.push(stripInlineMarkdown(line.trim()));
  }

  // If we never closed a code fence, drop it gracefully (don't pretend it's body).
  if (inCode && codeBuf.length > 0) {
    code = { language: codeLang, content: codeBuf.join("\n") };
  }

  // A "footer" is the last short body line that starts with a citation marker.
  let footer: string | null = null;
  if (body.length > 0) {
    const last = body[body.length - 1];
    if (/^(source|sources|via|—|--|cite|citation)/i.test(last) && last.length < 120) {
      footer = last;
      body.pop();
    }
  }

  return { title, subtitle, bullets, body, code, speakerNotes, footer };
}
