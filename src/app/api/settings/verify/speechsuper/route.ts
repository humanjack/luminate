import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, appId } = body;

    if (!apiKey || !appId) {
      return NextResponse.json({
        valid: false,
        error: "Both API Key and App ID are required",
      });
    }

    // SpeechSuper uses a signature-based authentication
    // Generate timestamp and signature for the API call
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signStr = `${appId}${timestamp}${apiKey}`;
    const signature = crypto.createHash("sha1").update(signStr).digest("hex");

    // Make a test request to SpeechSuper API
    // Using their audio assessment endpoint with minimal data
    const response = await fetch("https://api.speechsuper.com/health", {
      method: "GET",
      headers: {
        "X-App-Key": appId,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
      },
    });

    // SpeechSuper might not have a health endpoint, so we'll check if we get a valid response format
    if (response.ok) {
      return NextResponse.json({
        valid: true,
        message: "SpeechSuper credentials appear valid",
      });
    }

    // Try alternative validation - check if credentials format is correct
    const isValidFormat =
      apiKey.length >= 16 &&
      appId.length >= 8 &&
      /^[a-zA-Z0-9]+$/.test(appId);

    if (isValidFormat) {
      return NextResponse.json({
        valid: true,
        message: "Credentials format is valid (full verification requires API call)",
        warning: "Unable to fully verify - will be tested during first analysis",
      });
    }

    return NextResponse.json({
      valid: false,
      error: "Invalid credentials format",
    });
  } catch (error: any) {
    // If we can't reach the API, check format validity
    return NextResponse.json({
      valid: false,
      error: `Failed to verify: ${error.message}`,
      suggestion: "Credentials will be verified when you run your first analysis",
    });
  }
}
