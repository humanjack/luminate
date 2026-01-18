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

    // Verify by listing models
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return NextResponse.json({
        valid: true,
        message: "API key is valid",
      });
    } else if (response.status === 401) {
      return NextResponse.json({
        valid: false,
        error: "Invalid API key",
      });
    } else {
      return NextResponse.json({
        valid: false,
        error: `API error: ${response.status}`,
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      valid: false,
      error: `Connection failed: ${error?.message || "Unknown error"}`,
    });
  }
}
