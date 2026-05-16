import { spawn } from "child_process";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";

export interface RenderSlideInput {
  /** 0-based slide index */
  index: number;
  /** Title shown on the slide */
  title: string;
  /** Body bullet text (optional) */
  body: string;
  /** Absolute filesystem path to the audio file for this slide */
  audioAbsolutePath: string;
  /** Duration in seconds — drives the slide's runtime */
  duration: number;
}

export interface RenderResult {
  outputAbsolutePath: string;
}

export interface RenderProjectOptions {
  projectId: string;
  slides: RenderSlideInput[];
  resolution: string;
  /** Reports progress 0-100 as work proceeds */
  onProgress?: (progress: number, stage: string) => void;
}

const FONT_CANDIDATES = [
  "/System/Library/Fonts/Helvetica.ttc",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
];

let cachedFont: string | null | undefined;
async function findFont(): Promise<string | null> {
  if (cachedFont !== undefined) return cachedFont;
  for (const candidate of FONT_CANDIDATES) {
    try {
      await readFile(candidate);
      cachedFont = candidate;
      return candidate;
    } catch {
      // try next
    }
  }
  cachedFont = null;
  return null;
}

let cachedDrawtext: boolean | undefined;
async function hasDrawtext(): Promise<boolean> {
  if (cachedDrawtext !== undefined) return cachedDrawtext;
  cachedDrawtext = await new Promise<boolean>((resolve) => {
    const proc = spawn("ffmpeg", ["-hide_banner", "-filters"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("exit", () => resolve(/\bdrawtext\b/.test(out)));
    proc.on("error", () => resolve(false));
  });
  return cachedDrawtext;
}

/**
 * Render an entire project to MP4 + caption sidecar files.
 *
 * Strategy: for each slide we use ffmpeg with the `color=` lavfi source as
 * the background, drawtext to overlay title + body, and the slide's audio
 * file. The per-slide MP4s are then concatenated into the final video.
 *
 * Returns the absolute path of the produced MP4.
 */
export async function renderProjectVideo(
  options: RenderProjectOptions
): Promise<RenderResult> {
  const { projectId, slides, resolution, onProgress } = options;
  const outDir = path.join(process.cwd(), "public", "exports", projectId);
  await mkdir(outDir, { recursive: true });

  const total = slides.length;
  if (total === 0) {
    throw new Error("No slides to render");
  }

  const font = await findFont();
  const drawText = await hasDrawtext();
  const slideFiles: string[] = [];
  for (let i = 0; i < total; i++) {
    const slide = slides[i];
    onProgress?.(
      Math.round((i / total) * 80),
      `Rendering slide ${i + 1} of ${total}`
    );
    const slideOut = path.join(outDir, `slide-${i.toString().padStart(3, "0")}.mp4`);
    await renderSlide(slide, slideOut, resolution, drawText ? font : null);
    slideFiles.push(slideOut);
  }

  onProgress?.(85, "Concatenating slides");
  const finalPath = path.join(outDir, "final.mp4");
  const listPath = path.join(outDir, "concat-list.txt");
  await writeFile(
    listPath,
    slideFiles
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n"),
    "utf-8"
  );

  await runFfmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    finalPath,
  ]);

  onProgress?.(95, "Cleaning up");
  await Promise.all(
    slideFiles.map((p) => unlink(p).catch(() => undefined))
  );
  await unlink(listPath).catch(() => undefined);

  onProgress?.(100, "Done");
  return { outputAbsolutePath: finalPath };
}

async function renderSlide(
  slide: RenderSlideInput,
  outputPath: string,
  resolution: string,
  font: string | null
): Promise<void> {
  const [w, h] = resolution.split("x").map((s) => parseInt(s, 10));
  if (!w || !h) {
    throw new Error(`Invalid resolution: ${resolution}`);
  }
  const duration = Math.max(0.5, slide.duration);
  const title = ffmpegSanitize(slide.title || `Slide ${slide.index + 1}`);
  const body = ffmpegSanitize(slide.body || "").slice(0, 400);

  // ffmpeg drawtext needs a font; if none is available we fall back to a
  // monochrome card without text rather than failing the whole export.
  const titleFilter = font
    ? `drawtext=fontfile='${font}':text='${title}':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=h/2-160`
    : null;
  const bodyFilter = font && body
    ? `drawtext=fontfile='${font}':text='${body}':fontsize=40:fontcolor=#94A3B8:line_spacing=12:x=(w-text_w)/2:y=h/2-40`
    : null;
  const footerFilter = font
    ? `drawtext=fontfile='${font}':text='${slide.index + 1}':fontsize=24:fontcolor=#64748B:x=w-text_w-40:y=h-text_h-40`
    : null;

  const filters = [titleFilter, bodyFilter, footerFilter]
    .filter((f): f is string => Boolean(f))
    .join(",");

  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x0F172A:s=${w}x${h}:d=${duration.toFixed(3)}:r=30`,
    "-i",
    slide.audioAbsolutePath,
    ...(filters ? ["-vf", filters] : []),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-tune",
    "stillimage",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-t",
    duration.toFixed(3),
    outputPath,
  ];

  await runFfmpeg(args);
}

function ffmpegSanitize(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/\n/g, "\\\\n");
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}
