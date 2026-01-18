import { NextRequest, NextResponse } from "next/server";
import { db, settings } from "@/lib/db";

async function getSettings() {
  const allSettings = await db.select().from(settings);
  const settingsMap: Record<string, string> = {};
  for (const s of allSettings) {
    settingsMap[s.key] = s.value || "";
  }
  return settingsMap;
}

// POST /api/speech/analyze - Analyze audio recording
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordingId, audioPath, script } = body;

    const settingsData = await getSettings();
    const provider = settingsData.speechProvider || "speechsuper";

    // Check if API keys are configured
    const hasSpeechSuperConfig = settingsData.speechSuperApiKey && settingsData.speechSuperAppId;
    const hasElsaConfig = settingsData.elsaApiKey;
    const hasValidConfig = provider === "speechsuper" ? hasSpeechSuperConfig : hasElsaConfig;

    if (!hasValidConfig) {
      // Return mock data when no API is configured
      return NextResponse.json({
        recordingId,
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
          "Good overall pacing and clarity",
          "Consider reducing filler words like 'um' and 'uh'",
          "Practice the technical terminology for smoother delivery",
          "Try to maintain consistent volume throughout",
        ],
      });
    }

    // Real API integration would go here
    // For SpeechSuper:
    if (provider === "speechsuper") {
      // const result = await callSpeechSuperAPI(settingsData.speechSuperApiKey, settingsData.speechSuperAppId, audioPath, script);
      // return NextResponse.json(result);
    }

    // For ELSA:
    if (provider === "elsa") {
      // const result = await callElsaAPI(settingsData.elsaApiKey, audioPath, script);
      // return NextResponse.json(result);
    }

    // Return mock data as fallback
    return NextResponse.json({
      recordingId,
      overallScore: 75 + Math.random() * 20,
      pronunciationScore: 70 + Math.random() * 25,
      fluencyScore: 72 + Math.random() * 23,
      confidenceScore: 68 + Math.random() * 27,
      naturalnessScore: 73 + Math.random() * 22,
      wordsPerMinute: 120 + Math.random() * 40,
      fillerWords: [
        { word: "um", count: Math.floor(Math.random() * 5), timestamps: [] },
        { word: "uh", count: Math.floor(Math.random() * 3), timestamps: [] },
      ].filter((fw) => fw.count > 0),
      segments: [],
      recommendations: [
        "Good overall delivery",
        "Consider slowing down slightly for complex topics",
        "Practice pronunciation of technical terms",
      ],
    });
  } catch (error) {
    console.error("Speech analysis failed:", error);
    return NextResponse.json(
      { error: "Speech analysis failed" },
      { status: 500 }
    );
  }
}

// Placeholder for SpeechSuper API integration
async function callSpeechSuperAPI(
  apiKey: string,
  appId: string,
  audioPath: string,
  script: string
) {
  // SpeechSuper API implementation would go here
  // Documentation: https://docs.speechsuper.com/
  throw new Error("Not implemented");
}

// Placeholder for ELSA API integration
async function callElsaAPI(apiKey: string, audioPath: string, script: string) {
  // ELSA API implementation would go here
  throw new Error("Not implemented");
}
