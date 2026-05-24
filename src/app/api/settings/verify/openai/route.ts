import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({
        valid: false,
        error: "API key is required",
      });
    }

    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return NextResponse.json({ valid: true });
    }

    let errorMessage = `Invalid API key (HTTP ${response.status})`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error?.message) {
        errorMessage = errorBody.error.message;
      }
    } catch {
      // ignore JSON parse errors
    }

    return NextResponse.json({
      valid: false,
      error: errorMessage,
    });
  } catch (error: any) {
    console.error("[Verify OpenAI] Error:", error);
    return NextResponse.json({
      valid: false,
      error: `Connection failed: ${error?.message || "Unknown error"}`,
    });
  }
}
