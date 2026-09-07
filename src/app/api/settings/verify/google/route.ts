import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

const BACKEND_URL = env.BACKEND_URL;

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

    // First, save the API key to backend
    await fetch(`${BACKEND_URL}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ googleApiKey: apiKey }),
    });

    // Then verify via backend
    const response = await fetch(`${BACKEND_URL}/api/settings/verify/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Verify Google] Error:", error);
    return NextResponse.json({
      valid: false,
      error: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
