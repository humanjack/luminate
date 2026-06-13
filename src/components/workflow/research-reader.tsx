"use client";

import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Heading {
  level: number;
  text: string;
  id: string;
}

/** Allow only safe URL schemes; fall back to "#" (defense-in-depth — React
 *  already blocks javascript: URLs, but this avoids rendering inert junk). */
export function safeHref(url: string): string {
  const u = url.trim();
  return /^(https?:|mailto:|#|\/)/i.test(u) ? u : "#";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/** Extract h1–h3 headings (with stable, de-duplicated ids) for a TOC. */
export function extractHeadings(markdown: string): Heading[] {
  const out: Heading[] = [];
  const seen = new Map<string, number>();
  for (const line of markdown.split("\n")) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line.trim());
    if (!m) continue;
    const text = m[2].trim();
    let id = slugify(text) || "section";
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n > 0) id = `${id}-${n}`;
    out.push({ level: m[1].length, text, id });
  }
  return out;
}

/** Parse reference-style citation definitions: `[1]: https://example.com`. */
export function parseReferences(markdown: string): Record<string, string> {
  const refs: Record<string, string> = {};
  for (const line of markdown.split("\n")) {
    const m = /^\[(\d+)\]:\s*(\S+)/.exec(line.trim());
    if (m) refs[m[1]] = m[2];
  }
  return refs;
}

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(_[^_]+_)|(\[[^\]]+\]\([^)]+\))|(\[\d+\])/g;

/** Render inline markdown (bold, italic, code, links, citation chips). */
export function renderInline(
  text: string,
  refs: Record<string, string> = {},
  keyPrefix = "i"
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  let k = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyPrefix}-${k++}`;
    if (m[1]) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono">
          {token.slice(1, -1)}
        </code>
      );
    } else if (m[2]) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (m[3]) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (m[4]) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
      nodes.push(
        <a
          key={key}
          href={safeHref(lm[2])}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {lm[1]}
        </a>
      );
    } else if (m[5]) {
      const num = token.slice(1, -1);
      const url = refs[num];
      const chip = (
        <sup
          className="ml-0.5 inline-flex items-center rounded bg-primary/10 px-1 text-[0.7em] font-semibold text-primary align-super"
          data-testid="citation-chip"
        >
          {num}
        </sup>
      );
      nodes.push(
        url ? (
          <a key={key} href={safeHref(url)} target="_blank" rel="noopener noreferrer">
            {chip}
          </a>
        ) : (
          <Fragment key={key}>{chip}</Fragment>
        )
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

interface Block {
  type: "h1" | "h2" | "h3" | "p" | "ul" | "ol" | "quote" | "code";
  lines: string[];
  id?: string;
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  const headingIds = new Map<string, number>();
  const idFor = (text: string) => {
    const id = slugify(text) || "section";
    const n = headingIds.get(id) ?? 0;
    headingIds.set(id, n + 1);
    return n > 0 ? `${id}-${n}` : id;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }
    // Skip reference definitions (rendered as citation targets, not content)
    if (/^\[\d+\]:\s*\S+/.test(trimmed)) {
      i++;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const text = heading[2].trim();
      const level = heading[1].length;
      blocks.push({
        type: (`h${level}` as "h1" | "h2" | "h3"),
        lines: [text],
        id: idFor(text),
      });
      i++;
      continue;
    }
    if (trimmed.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ type: "code", lines: code });
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", lines: quote });
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", lines: items });
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", lines: items });
      continue;
    }
    // paragraph: gather consecutive plain lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s|>|[-*]\s|\d+\.\s|```)/.test(lines[i].trim()) &&
      !/^\[\d+\]:\s*\S+/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) blocks.push({ type: "p", lines: [para.join(" ")] });
  }
  return blocks;
}

interface ResearchReaderProps {
  markdown: string;
  className?: string;
}

/**
 * Renders research markdown as a typographic reader with a table of contents,
 * citation chips, and a sources list. Dependency-free and XSS-safe — all text
 * is rendered as React children (no dangerouslySetInnerHTML).
 */
export function ResearchReader({ markdown, className }: ResearchReaderProps) {
  const refs = parseReferences(markdown);
  const blocks = parseBlocks(markdown);
  const headings = blocks
    .filter((b) => b.type === "h1" || b.type === "h2" || b.type === "h3")
    .map((b) => ({
      level: Number(b.type.slice(1)),
      text: b.lines[0],
      id: b.id!,
    }));
  const refList = Object.entries(refs);

  return (
    <div className={cn("space-y-5", className)} data-testid="research-reader">
      {headings.length >= 3 && (
        <nav
          className="rounded-lg border bg-muted/30 p-4"
          aria-label="Table of contents"
          data-testid="research-toc"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Contents
          </p>
          <ul className="space-y-1 text-sm">
            {headings.map((h) => (
              <li key={h.id} style={{ paddingLeft: (h.level - 1) * 12 }}>
                <a href={`#${h.id}`} className="text-primary hover:underline">
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <article className="space-y-4 leading-relaxed">
        {blocks.map((b, idx) => {
          switch (b.type) {
            case "h1":
              return (
                <h1 id={b.id} key={idx} className="text-2xl font-bold mt-2 scroll-mt-20">
                  {renderInline(b.lines[0], refs, `h${idx}`)}
                </h1>
              );
            case "h2":
              return (
                <h2 id={b.id} key={idx} className="text-xl font-semibold mt-2 scroll-mt-20">
                  {renderInline(b.lines[0], refs, `h${idx}`)}
                </h2>
              );
            case "h3":
              return (
                <h3 id={b.id} key={idx} className="text-lg font-semibold scroll-mt-20">
                  {renderInline(b.lines[0], refs, `h${idx}`)}
                </h3>
              );
            case "ul":
              return (
                <ul key={idx} className="list-disc pl-6 space-y-1">
                  {b.lines.map((li, j) => (
                    <li key={j}>{renderInline(li, refs, `${idx}-${j}`)}</li>
                  ))}
                </ul>
              );
            case "ol":
              return (
                <ol key={idx} className="list-decimal pl-6 space-y-1">
                  {b.lines.map((li, j) => (
                    <li key={j}>{renderInline(li, refs, `${idx}-${j}`)}</li>
                  ))}
                </ol>
              );
            case "quote":
              return (
                <blockquote
                  key={idx}
                  className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground"
                >
                  {renderInline(b.lines.join(" "), refs, `q${idx}`)}
                </blockquote>
              );
            case "code":
              return (
                <pre
                  key={idx}
                  className="rounded-lg bg-muted p-3 overflow-auto text-sm font-mono"
                >
                  {b.lines.join("\n")}
                </pre>
              );
            default:
              return (
                <p key={idx} className="text-[15px]">
                  {renderInline(b.lines[0], refs, `p${idx}`)}
                </p>
              );
          }
        })}
      </article>

      {refList.length > 0 && (
        <section data-testid="research-sources">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Sources
          </h3>
          <ol className="list-decimal pl-6 space-y-1 text-sm">
            {refList.map(([num, url]) => (
              <li key={num}>
                <a
                  href={safeHref(url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 break-all"
                >
                  {url}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
