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

    // ELSA API verification
    // Try to make a simple API call to verify the key
    const response = await fetch("https://api.elsaspeak.com/v1/health", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return NextResponse.json({
        valid: true,
        message: "ELSA API key is valid",
      });
    }

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({
        valid: false,
        error: "Invalid API key. Please check your ELSA API key.",
      });
    }

    // Check format validity as fallback
    const isValidFormat = apiKey.length >= 20;

    if (isValidFormat) {
      return NextResponse.json({
        valid: true,
        message: "API key format is valid",
        warning: "Full verification will occur during first analysis",
      });
    }

    return NextResponse.json({
      valid: false,
      error: "Invalid API key format",
    });
  } catch (error: any) {
    return NextResponse.json({
      valid: false,
      error: `Failed to verify: ${error.message}`,
      suggestion: "API key will be verified when you run your first analysis",
    });
  }
}
