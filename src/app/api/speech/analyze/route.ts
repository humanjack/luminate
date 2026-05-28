import { NextRequest, NextResponse } from "next/server";
import { db, settings } from "@/lib/db";
import { analyzeWithAzure } from "@/lib/analysis/azure";
import { analyzeWithOpenAI } from "@/lib/analysis/openai";

async function getSettings() {
  const allSettings = await db.select().from(settings);
  const settingsMap: Record<string, string> = {};
  for (const s of allSettings) {
    let v = s.value || "";
    // Settings are JSON-stringified on write; unwrap simple strings
    if (v.startsWith('"') && v.endsWith('"')) {
      try { v = JSON.parse(v); } catch { /* keep raw */ }
    }
    settingsMap[s.key] = v;
  }
  return settingsMap;
}

function mockResult(recordingId: string) {
  return {
    recordingId,
    provider: "mock",
    overallScore: 75 + Math.random() * 20,
    pronunciationScore: 70 + Math.random() * 25,
    fluencyScore: 72 + Math.random() * 23,
    confidenceScore: 68 + Math.random() * 27,
    naturalnessScore: 73 + Math.random() * 22,
    wordsPerMinute: 120 + Math.random() * 40,
    fillerWords: [
      { word: "um", count: Math.floor(Math.random() * 5), timestamps: [] },
      { word: "uh", count: Math.floor(Math.random() * 3), timestamps: [] },
      { word: "like", count: Math.floor(Math.random() * 4), timestamps: [] },
    ].filter((fw) => fw.count > 0),
    segments: [],
    recommendations: [
      "Mock analysis — configure a real speech provider in Settings.",
      "Azure offers a free tier (5 hrs/month) with phoneme-level scoring.",
      "OpenAI compares transcripts against your script.",
    ],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordingId, audioPath, script } = body as {
      recordingId: string;
      audioPath: string;
      script: string;
    };

    if (!recordingId || !audioPath) {
      return NextResponse.json({ error: "recordingId and audioPath required" }, { status: 400 });
    }

    const settingsData = await getSettings();
    const provider = settingsData.speechProvider || "speechsuper";

    if (provider === "azure") {
      const apiKey = settingsData.azureSpeechKey;
      const region = settingsData.azureSpeechRegion;
      if (!apiKey || !region) {
        return NextResponse.json(mockResult(recordingId));
      }
      try {
        const result = await analyzeWithAzure({ apiKey, region, audioPath, script });
        return NextResponse.json({ recordingId, ...result });
      } catch (err) {
        console.error("Azure analysis failed:", err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Azure analysis failed" },
          { status: 502 }
        );
      }
    }

    if (provider === "openai") {
      const apiKey = settingsData.openaiApiKey;
      if (!apiKey) {
        return NextResponse.json(mockResult(recordingId));
      }
      try {
        const result = await analyzeWithOpenAI({ apiKey, audioPath, script });
        return NextResponse.json({ recordingId, ...result });
      } catch (err) {
        console.error("OpenAI analysis failed:", err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "OpenAI analysis failed" },
          { status: 502 }
        );
      }
    }

    // SpeechSuper / ELSA stubs — not implemented yet, return mock
    return NextResponse.json(mockResult(recordingId));
  } catch (error) {
    console.error("Speech analysis failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Speech analysis failed" },
      { status: 500 }
    );
  }
}
