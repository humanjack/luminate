import { NextRequest } from "next/server";
import { proxyLLMStream, jsonError } from "@/lib/llm/proxy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { research, format, targetLength } = await request.json();

  if (!research) {
    return jsonError("Research content is required", 400);
  }

  return proxyLLMStream(
    "/api/llm/content",
    { research, format, target_length: targetLength },
    "LLM Content"
  );
}
