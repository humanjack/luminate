import { promises as fs } from "fs";
import { transcodeToWav16k, countFillerWords } from "./audio";

export interface AzureAnalysisInput {
  apiKey: string;
  region: string;
  audioPath: string;
  script: string;
  language?: string;
}

interface AzureNBestItem {
  Confidence?: number;
  Lexical?: string;
  Display?: string;
  PronunciationAssessment?: {
    AccuracyScore?: number;
    FluencyScore?: number;
    CompletenessScore?: number;
    PronScore?: number;
    ProsodyScore?: number;
  };
  Words?: Array<{
    Word: string;
    Offset: number;
    Duration: number;
    PronunciationAssessment?: {
      AccuracyScore?: number;
      ErrorType?: string;
    };
    Phonemes?: Array<{
      Phoneme: string;
      Offset: number;
      Duration: number;
      PronunciationAssessment?: { AccuracyScore?: number };
    }>;
  }>;
}

interface AzureResponse {
  RecognitionStatus: string;
  Offset?: number;
  Duration?: number;
  DisplayText?: string;
  NBest?: AzureNBestItem[];
}

export async function analyzeWithAzure(input: AzureAnalysisInput) {
  const { apiKey, region, audioPath, script } = input;
  const language = input.language || "en-US";

  if (!script.trim()) {
    throw new Error("Azure pronunciation assessment requires a reference script");
  }

  const { wavPath, cleanup } = await transcodeToWav16k(audioPath);

  try {
    const wavBuffer = await fs.readFile(wavPath);

    const paConfig = {
      ReferenceText: script,
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: true,
      EnableProsodyAssessment: true,
    };
    const paHeader = Buffer.from(JSON.stringify(paConfig)).toString("base64");

    const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=detailed`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Pronunciation-Assessment": paHeader,
        "Accept": "application/json",
      },
      body: new Uint8Array(wavBuffer),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Azure Speech API error ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = (await response.json()) as AzureResponse;

    if (data.RecognitionStatus !== "Success" || !data.NBest?.length) {
      throw new Error(`Azure did not return a recognition result (status: ${data.RecognitionStatus})`);
    }

    const best = data.NBest[0];
    const pa = best.PronunciationAssessment || {};

    const words = (best.Words || []).map((w) => ({
      word: w.Word,
      startTime: w.Offset / 10_000_000,
      endTime: (w.Offset + w.Duration) / 10_000_000,
      pronunciationScore: w.PronunciationAssessment?.AccuracyScore,
      errorType: w.PronunciationAssessment?.ErrorType,
      phonemes: w.Phonemes?.map((p) => ({
        phoneme: p.Phoneme,
        score: p.PronunciationAssessment?.AccuracyScore ?? 0,
      })),
    }));

    const totalDuration = (data.Duration ?? 0) / 10_000_000 || (words.at(-1)?.endTime ?? 0);
    const wordCount = words.filter((w) => w.errorType !== "Insertion").length;
    const wordsPerMinute = totalDuration > 0 ? (wordCount / totalDuration) * 60 : 0;

    const fillerWords = countFillerWords(words.map((w) => ({ word: w.word, start: w.startTime })));

    const mispronounced = words.filter((w) => w.errorType && w.errorType !== "None").slice(0, 6);
    const recommendations: string[] = [];
    if ((pa.PronScore ?? 0) >= 90) recommendations.push("Excellent pronunciation across the board.");
    else if ((pa.PronScore ?? 0) >= 75) recommendations.push("Good pronunciation overall — small refinements possible.");
    else recommendations.push("Pronunciation needs more practice — focus on highlighted words.");

    if (mispronounced.length > 0) {
      const wordList = mispronounced.map((w) => `"${w.word}" (${w.errorType})`).join(", ");
      recommendations.push(`Words to review: ${wordList}`);
    }

    if (wordsPerMinute > 0) {
      if (wordsPerMinute < 110) recommendations.push(`Speaking rate is slow (${Math.round(wordsPerMinute)} WPM). Aim for 120–150 WPM.`);
      else if (wordsPerMinute > 165) recommendations.push(`Speaking rate is fast (${Math.round(wordsPerMinute)} WPM). Slow down for clarity.`);
      else recommendations.push(`Speaking pace is solid at ${Math.round(wordsPerMinute)} WPM.`);
    }

    if ((pa.FluencyScore ?? 0) < 75) recommendations.push("Work on smoother delivery — reduce hesitations between words.");

    return {
      provider: "azure",
      overallScore: pa.PronScore ?? Math.round(((pa.AccuracyScore ?? 0) + (pa.FluencyScore ?? 0) + (pa.CompletenessScore ?? 0)) / 3),
      pronunciationScore: pa.AccuracyScore ?? pa.PronScore ?? 0,
      fluencyScore: pa.FluencyScore ?? 0,
      confidenceScore: pa.CompletenessScore ?? 0,
      naturalnessScore: pa.ProsodyScore ?? pa.FluencyScore ?? 0,
      wordsPerMinute,
      fillerWords,
      segments: words.map((w) => ({
        word: w.word,
        startTime: w.startTime,
        endTime: w.endTime,
        pronunciationScore: w.pronunciationScore,
        phonemes: w.phonemes,
      })),
      recommendations,
      transcript: best.Display || best.Lexical || "",
    };
  } finally {
    await cleanup();
  }
}

export async function verifyAzureCredentials(apiKey: string, region: string): Promise<{ valid: boolean; message?: string; error?: string }> {
  const url = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Length": "0",
      },
    });
    if (response.ok) {
      return { valid: true, message: `Azure Speech credentials valid for region ${region}` };
    }
    return { valid: false, error: `Azure returned ${response.status}: ${await response.text().catch(() => "")}` };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
