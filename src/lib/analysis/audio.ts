import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const FILLER_WORDS = ["um", "uh", "uhm", "er", "ah", "like", "you know", "so", "actually", "basically", "literally", "right"];

export const COMMON_FILLERS = FILLER_WORDS;

export function resolveAudioFile(audioPath: string): string {
  if (audioPath.startsWith("/recordings/")) {
    return path.join(process.cwd(), "public", audioPath.replace(/^\//, ""));
  }
  if (path.isAbsolute(audioPath)) return audioPath;
  return path.join(process.cwd(), audioPath);
}

export async function readAudioBuffer(audioPath: string): Promise<Buffer> {
  return fs.readFile(resolveAudioFile(audioPath));
}

export async function transcodeToWav16k(inputPath: string): Promise<{ wavPath: string; cleanup: () => Promise<void> }> {
  const resolvedInput = resolveAudioFile(inputPath);
  const wavPath = path.join(tmpdir(), `luminate-${randomUUID()}.wav`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-y",
      "-i", resolvedInput,
      "-ac", "1",
      "-ar", "16000",
      "-acodec", "pcm_s16le",
      "-f", "wav",
      wavPath,
    ], { stdio: ["ignore", "ignore", "pipe"] });

    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("error", (err) => reject(new Error(`ffmpeg spawn failed: ${err.message}. Is ffmpeg installed?`)));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });

  return {
    wavPath,
    cleanup: async () => {
      try { await fs.unlink(wavPath); } catch { /* ignore */ }
    },
  };
}

export function countFillerWords(
  words: Array<{ word: string; start?: number }>
): Array<{ word: string; count: number; timestamps: number[] }> {
  const map = new Map<string, { count: number; timestamps: number[] }>();
  for (const w of words) {
    const norm = w.word.toLowerCase().replace(/[^a-z']/g, "");
    if (FILLER_WORDS.includes(norm)) {
      const entry = map.get(norm) ?? { count: 0, timestamps: [] };
      entry.count += 1;
      if (typeof w.start === "number") entry.timestamps.push(w.start);
      map.set(norm, entry);
    }
  }
  return Array.from(map.entries()).map(([word, v]) => ({ word, count: v.count, timestamps: v.timestamps }));
}
