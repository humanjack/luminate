import { open, realpath } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { mediaRoot } from "@/lib/paths";

const MIME: Record<string, string> = {
  ".webm": "audio/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".mp4": "video/mp4",
  ".vtt": "text/vtt; charset=utf-8", ".srt": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
};

/** Serve files created after build from the same volume used by record/export. */
export async function serveMedia(request: Request, kind: "recordings" | "exports", parts: string[]) {
  if (!parts.length || parts.some((part) => !part || part === "." || part === ".." || /[/\\\0]/.test(part))) {
    return new Response(null, { status: 404 });
  }
  let file;
  try {
    const root = await realpath(path.join(mediaRoot(), kind));
    const target = await realpath(path.join(root, ...parts));
    if (!target.startsWith(root + path.sep) || !MIME[path.extname(target)]) return new Response(null, { status: 404 });
    file = await open(target, "r");
    const stat = await file.stat();
    if (!stat.isFile()) { await file.close(); return new Response(null, { status: 404 }); }
    const headers = new Headers({
      "Content-Type": MIME[path.extname(target)], "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff",
    });
    let start = 0;
    let end = stat.size - 1;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      } else { start = -1; }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= stat.size) {
        await file.close();
        headers.set("Content-Range", `bytes */${stat.size}`);
        return new Response(null, { status: 416, headers });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    }
    headers.set("Content-Length", String(Math.max(0, end - start + 1)));
    if (request.method === "HEAD" || stat.size === 0) {
      await file.close();
      return new Response(null, { status: range ? 206 : 200, headers });
    }
    const body = Readable.toWeb(file.createReadStream({ start, end })) as ReadableStream<Uint8Array>;
    return new Response(body, { status: range ? 206 : 200, headers });
  } catch (error) {
    await file?.close().catch(() => {});
    if (error instanceof Error && "code" in error && ["ENOENT", "ENOTDIR"].includes(String(error.code))) {
      return new Response(null, { status: 404 });
    }
    throw error;
  }
}
