import { promises as fs } from "fs";
import { countFillerWords, resolveAudioFile, COMMON_FILLERS } from "./audio";

export interface OpenAIAnalysisInput {
  apiKey: string;
  audioPath: string;
  script: string;
  model?: string;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface TranscriptionResponse {
  text: string;
  duration?: number;
  words?: WhisperWord[];
}

export type DiffOp =
  | { type: "match"; scriptWord: string; transcriptWord: string; timestamp?: number }
  | { type: "missing"; scriptWord: string }
  | { type: "extra"; transcriptWord: string; timestamp?: number }
  | { type: "substitution"; scriptWord: string; transcriptWord: string; timestamp?: number };

function normalize(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9']/g, "");
}

function tokenizeScript(script: string): string[] {
  return script.split(/\s+/).map((w) => w.trim()).filter(Boolean);
}

// Word-level alignment via Needleman-Wunsch (gap penalty -1, match +1, mismatch 0)
export function alignWords(scriptWords: string[], transcriptWords: WhisperWord[]): DiffOp[] {
  const a = scriptWords.map(normalize);
  const b = transcriptWords.map((w) => normalize(w.word));
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = -i;
  for (let j = 0; j <= n; j++) dp[0][j] = -j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const match = dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 1 : 0);
      const del = dp[i - 1][j] - 1;
      const ins = dp[i][j - 1] - 1;
      dp[i][j] = Math.max(match, del, ins);
    }
  }

  const ops: DiffOp[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const diag = dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 1 : 0);
      const del = dp[i - 1][j] - 1;
      const ins = dp[i][j - 1] - 1;
      const best = Math.max(diag, del, ins);
      if (best === diag) {
        if (a[i - 1] === b[j - 1]) {
          ops.push({ type: "match", scriptWord: scriptWords[i - 1], transcriptWord: transcriptWords[j - 1].word, timestamp: transcriptWords[j - 1].start });
        } else {
          ops.push({ type: "substitution", scriptWord: scriptWords[i - 1], transcriptWord: transcriptWords[j - 1].word, timestamp: transcriptWords[j - 1].start });
        }
        i--; j--;
        continue;
      }
      if (best === del) {
        ops.push({ type: "missing", scriptWord: scriptWords[i - 1] });
        i--;
        continue;
      }
      ops.push({ type: "extra", transcriptWord: transcriptWords[j - 1].word, timestamp: transcriptWords[j - 1].start });
      j--;
    } else if (i > 0) {
      ops.push({ type: "missing", scriptWord: scriptWords[i - 1] });
      i--;
    } else {
      ops.push({ type: "extra", transcriptWord: transcriptWords[j - 1].word, timestamp: transcriptWords[j - 1].start });
      j--;
    }
  }

  return ops.reverse();
}

export async function transcribeWithOpenAI(
  apiKey: string,
  audioPath: string,
  model: string = "gpt-4o-mini-transcribe"
): Promise<TranscriptionResponse> {
  const resolved = resolveAudioFile(audioPath);
  const audioBuffer = await fs.readFile(resolved);
  const filename = resolved.split("/").pop() || "audio.webm";

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audioBuffer)]), filename);
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI transcription failed ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  // gpt-4o-mini-transcribe may not return word timestamps for all formats; fall back to whisper-1 shape
  return {
    text: data.text || "",
    duration: data.duration,
    words: Array.isArray(data.words) ? data.words : [],
  };
}

export async function analyzeWithOpenAI(input: OpenAIAnalysisInput) {
  const { apiKey, audioPath, script } = input;
  let model = input.model || "gpt-4o-mini-transcribe";

  let transcription: TranscriptionResponse;
  try {
    transcription = await transcribeWithOpenAI(apiKey, audioPath, model);
  } catch (err) {
    // gpt-4o-mini-transcribe doesn't support word-level timestamps for verbose_json yet — fall back to whisper-1
    if (err instanceof Error && /timestamp_granularities|unsupported|verbose_json/i.test(err.message)) {
      model = "whisper-1";
      transcription = await transcribeWithOpenAI(apiKey, audioPath, model);
    } else {
      throw err;
    }
  }

  const transcriptWords: WhisperWord[] = transcription.words?.length
    ? transcription.words
    : transcription.text.split(/\s+/).filter(Boolean).map((w, i, arr) => {
        const dur = transcription.duration ?? arr.length * 0.4;
        return { word: w, start: (i / arr.length) * dur, end: ((i + 1) / arr.length) * dur };
      });

  const scriptWords = tokenizeScript(script);
  const diff = scriptWords.length > 0 ? alignWords(scriptWords, transcriptWords) : [];

  const matches = diff.filter((d) => d.type === "match").length;
  const missing = diff.filter((d) => d.type === "missing").length;
  const substitutions = diff.filter((d) => d.type === "substitution").length;
  const extras = diff.filter((d) => d.type === "extra").length;

  const accuracy = scriptWords.length > 0 ? (matches / scriptWords.length) * 100 : 0;
  const pronunciationScore = Math.round(accuracy);

  const duration = transcription.duration ?? (transcriptWords.at(-1)?.end ?? 0);
  const wordsPerMinute = duration > 0 ? (transcriptWords.length / duration) * 60 : 0;

  // Fluency = penalize big gaps between consecutive transcribed words
  let bigGaps = 0;
  for (let i = 1; i < transcriptWords.length; i++) {
    const gap = transcriptWords[i].start - transcriptWords[i - 1].end;
    if (gap > 0.8) bigGaps++;
  }
  const gapRatio = transcriptWords.length > 0 ? bigGaps / transcriptWords.length : 0;
  const fluencyScore = Math.max(0, Math.round(100 - gapRatio * 200));

  const fillerWords = countFillerWords(transcriptWords);
  const fillerCount = fillerWords.reduce((s, f) => s + f.count, 0);
  const fillerRatio = transcriptWords.length > 0 ? fillerCount / transcriptWords.length : 0;
  const naturalnessScore = Math.max(0, Math.round(100 - fillerRatio * 300));

  const completeness = scriptWords.length > 0 ? ((scriptWords.length - missing) / scriptWords.length) * 100 : 0;
  const confidenceScore = Math.round(completeness);

  const overallScore = Math.round((pronunciationScore + fluencyScore + naturalnessScore + confidenceScore) / 4);

  const recommendations: string[] = [];
  if (scriptWords.length > 0) {
    if (accuracy >= 95) recommendations.push("Excellent script accuracy — you nailed nearly every word.");
    else if (accuracy >= 85) recommendations.push(`Good accuracy (${Math.round(accuracy)}%). A few words drifted from the script.`);
    else recommendations.push(`Accuracy is ${Math.round(accuracy)}% — consider re-reading or re-recording sections that diverged.`);

    if (missing > 0) recommendations.push(`${missing} script word${missing > 1 ? "s were" : " was"} skipped.`);
    if (substitutions > 0) recommendations.push(`${substitutions} word${substitutions > 1 ? "s" : ""} substituted.`);
    if (extras > 3) recommendations.push(`${extras} extra words spoken beyond the script — watch for ad-libbing.`);
  } else {
    recommendations.push("No script provided — only transcript-level metrics computed.");
  }

  if (wordsPerMinute > 0) {
    if (wordsPerMinute < 110) recommendations.push(`Pace is slow at ${Math.round(wordsPerMinute)} WPM. Aim for 120–150.`);
    else if (wordsPerMinute > 165) recommendations.push(`Pace is fast at ${Math.round(wordsPerMinute)} WPM. Slow down for clarity.`);
    else recommendations.push(`Pace is good at ${Math.round(wordsPerMinute)} WPM.`);
  }

  if (fillerCount > 0) {
    const list = fillerWords.map((f) => `"${f.word}" ×${f.count}`).join(", ");
    recommendations.push(`Filler words detected: ${list}.`);
  }

  return {
    provider: "openai",
    overallScore,
    pronunciationScore,
    fluencyScore,
    confidenceScore,
    naturalnessScore,
    wordsPerMinute,
    fillerWords,
    segments: transcriptWords.map((w) => ({
      word: w.word,
      startTime: w.start,
      endTime: w.end,
    })),
    recommendations,
    transcript: transcription.text,
    diff,
    model,
  };
}
