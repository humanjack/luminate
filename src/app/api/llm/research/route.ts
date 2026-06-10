import { NextRequest } from "next/server";
import { proxyLLMStream, jsonError } from "@/lib/llm/proxy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { topic, depth } = await request.json();

  if (!topic) {
    return jsonError("Topic is required", 400);
  }

  return proxyLLMStream("/api/llm/research", { topic, depth }, "LLM Research");
}
