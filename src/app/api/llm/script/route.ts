import { NextRequest } from "next/server";
import { proxyLLMStream, jsonError } from "@/lib/llm/proxy";
import { readJson } from "@/lib/api/validate";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  const { slideContent, slideIndex } = (parsed.data ?? {}) as {
    slideContent?: string;
    slideIndex?: number;
  };

  if (!slideContent) {
    return jsonError("Slide content is required", 400);
  }

  return proxyLLMStream(
    "/api/llm/script",
    { slide_content: slideContent, slide_index: slideIndex },
    "LLM Script"
  );
}
