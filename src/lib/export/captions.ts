import type { Slide, Script, Recording } from "@/lib/db/schema";

export interface CaptionInput {
  slide: Pick<Slide, "index" | "markdown">;
  script: Pick<Script, "text"> | undefined;
  recording: Pick<Recording, "duration"> | undefined;
}

export interface SlideSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * Build per-slide caption segments. Each slide's recording runs back to back,
 * so the offsets accumulate. Falls back to `script.text` when present, then to
 * the first line of the slide markdown.
 */
export function buildSegments(inputs: CaptionInput[]): SlideSegment[] {
  const out: SlideSegment[] = [];
  let cursor = 0;
  for (const { slide, script, recording } of inputs) {
    const dur = recording?.duration ?? 0;
    if (dur <= 0) continue;
    const text =
      (script?.text || "").trim() ||
      slide.markdown.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "").trim() ||
      `Slide ${slide.index + 1}`;
    out.push({ start: cursor, end: cursor + dur, text });
    cursor += dur;
  }
  return out;
}

export function toVtt(segments: SlideSegment[]): string {
  const head = "WEBVTT\n\n";
  return (
    head +
    segments
      .map(
        (s, i) =>
          `${i + 1}\n${tsVtt(s.start)} --> ${tsVtt(s.end)}\n${escapeVtt(s.text)}\n`
      )
      .join("\n")
  );
}

export function toSrt(segments: SlideSegment[]): string {
  return segments
    .map(
      (s, i) =>
        `${i + 1}\n${tsSrt(s.start)} --> ${tsSrt(s.end)}\n${s.text}\n`
    )
    .join("\n");
}

export function toTranscript(segments: SlideSegment[]): string {
  return segments
    .map(
      (s, i) =>
        `[${tsShort(s.start)} – ${tsShort(s.end)}] Slide ${i + 1}\n${s.text}\n`
    )
    .join("\n");
}

export function toSourceList(
  projectName: string,
  sources: Array<{ title: string | null; url: string | null; type: string }>
): string {
  const lines = [`# Source list — ${projectName}`, ""];
  if (sources.length === 0) {
    lines.push("_No sources attached to this project._");
    return lines.join("\n") + "\n";
  }
  for (const s of sources) {
    if (s.url) {
      lines.push(`- [${s.title || s.url}](${s.url})`);
    } else {
      lines.push(`- ${s.title || s.type}`);
    }
  }
  return lines.join("\n") + "\n";
}

function tsVtt(seconds: number): string {
  return formatTimestamp(seconds, ".");
}
function tsSrt(seconds: number): string {
  return formatTimestamp(seconds, ",");
}
function tsShort(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatTimestamp(seconds: number, msSep: string): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe - Math.floor(safe)) * 1000);
  return (
    `${String(h).padStart(2, "0")}:` +
    `${String(m).padStart(2, "0")}:` +
    `${String(s).padStart(2, "0")}${msSep}${String(ms).padStart(3, "0")}`
  );
}

function escapeVtt(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
