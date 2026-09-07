import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/net/withTimeout";
import { readJson } from "@/lib/api/validate";

export async function POST(request: NextRequest) {
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  const apiKey = (parsed.data as { apiKey?: unknown } | null)?.apiKey;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return NextResponse.json({ valid: false, error: "API key is required" });
  }
  try {
    // Read-only validation against Anthropic; verification never persists a key.
    const response = await fetchWithTimeout("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, signal: request.signal,
    });
    await response.body?.cancel();
    return NextResponse.json(response.ok ? { valid: true } : {
      valid: false, error: `Anthropic returned HTTP ${response.status}. Check the API key and account access.`,
    });
  } catch {
    return NextResponse.json({ valid: false, error: "Could not reach Anthropic. Try again." });
  }
}
