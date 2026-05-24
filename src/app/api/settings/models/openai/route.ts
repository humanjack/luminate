import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "API key is required" },
        { status: 400 },
      );
    }

    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      let errorMessage = `OpenAI API error (HTTP ${response.status})`;
      try {
        const body = await response.json();
        if (body?.error?.message) errorMessage = body.error.message;
      } catch {}
      return NextResponse.json({ ok: false, error: errorMessage });
    }

    const body = (await response.json()) as {
      data?: Array<{ id: string }>;
    };

    const ids = (body.data ?? [])
      .map((m) => m.id)
      .filter((id) => /^(gpt-|o\d|chatgpt-)/i.test(id))
      .filter((id) => !/(audio|realtime|transcribe|tts|image|embedding|moderation|whisper|dall-e)/i.test(id))
      .sort();

    return NextResponse.json({ ok: true, models: ids });
  } catch (error: any) {
    console.error("[Models OpenAI] Error:", error);
    return NextResponse.json({
      ok: false,
      error: `Connection failed: ${error?.message || "Unknown error"}`,
    });
  }
}
