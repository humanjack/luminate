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

    const response = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) {
      let errorMessage = `Anthropic API error (HTTP ${response.status})`;
      try {
        const body = await response.json();
        if (body?.error?.message) errorMessage = body.error.message;
      } catch {}
      return NextResponse.json({ ok: false, error: errorMessage });
    }

    const body = (await response.json()) as {
      data?: Array<{ id: string; display_name?: string }>;
    };

    const models = (body.data ?? [])
      .map((m) => ({ id: m.id, label: m.display_name || m.id }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({ ok: true, models });
  } catch (error: any) {
    console.error("[Models Anthropic] Error:", error);
    return NextResponse.json({
      ok: false,
      error: `Connection failed: ${error?.message || "Unknown error"}`,
    });
  }
}
