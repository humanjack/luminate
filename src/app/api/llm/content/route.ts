import { NextRequest } from "next/server";
import { proxyLLMStream, jsonError } from "@/lib/llm/proxy";
import { readJson } from "@/lib/api/validate";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  const { research, format, targetLength } = (parsed.data ?? {}) as {
    research?: string;
    format?: string;
    targetLength?: number;
  };

  if (!research) {
    return jsonError("Research content is required", 400);
  }

  return proxyLLMStream(
    "/api/llm/content",
    { research, format, target_length: targetLength },
    "LLM Content"
  );
}
