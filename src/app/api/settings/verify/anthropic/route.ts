import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

    const client = new Anthropic({ apiKey });

    // Make a minimal API call to verify the key works
    const response = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 10,
      messages: [{ role: "user", content: "Hi" }],
    });

    return NextResponse.json({
      valid: true,
      message: "API key is valid",
      model: response.model,
    });
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown error";
    const isAuthError = errorMessage.includes("401") ||
                        errorMessage.includes("authentication") ||
                        errorMessage.includes("invalid") ||
                        errorMessage.includes("API key");

    return NextResponse.json({
      valid: false,
      error: isAuthError
        ? "Invalid API key. Please check your Anthropic API key."
        : `Connection failed: ${errorMessage}`,
    });
  }
}
