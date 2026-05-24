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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`,
      { method: "GET" },
    );

    if (!response.ok) {
      let errorMessage = `Google API error (HTTP ${response.status})`;
      try {
        const body = await response.json();
        if (body?.error?.message) errorMessage = body.error.message;
      } catch {}
      return NextResponse.json({ ok: false, error: errorMessage });
    }

    const body = (await response.json()) as {
      models?: Array<{
        name: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
    };

    const models = (body.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => ({
        id: m.name.replace(/^models\//, ""),
        label: m.displayName || m.name.replace(/^models\//, ""),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({ ok: true, models });
  } catch (error: any) {
    console.error("[Models Google] Error:", error);
    return NextResponse.json({
      ok: false,
      error: `Connection failed: ${error?.message || "Unknown error"}`,
    });
  }
}
