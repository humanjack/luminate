import { NextRequest } from "next/server";
import { proxyLLMStream, jsonError } from "@/lib/llm/proxy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { slideContent, slideIndex } = await request.json();

  if (!slideContent) {
    return jsonError("Slide content is required", 400);
  }

  return proxyLLMStream(
    "/api/llm/script",
    { slide_content: slideContent, slide_index: slideIndex },
    "LLM Script"
  );
}
