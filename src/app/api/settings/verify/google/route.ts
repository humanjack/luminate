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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: "GET" }
    );

    if (response.ok) {
      const data = await response.json();
      const modelCount = data.models?.length || 0;
      return NextResponse.json({
        valid: true,
        message: `API key is valid (${modelCount} models available)`,
      });
    } else if (response.status === 400 || response.status === 401) {
      const data = await response.json();
      return NextResponse.json({
        valid: false,
        error: data.error?.message || "Invalid API key",
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
