import { NextRequest } from "next/server";
import { generationResponse } from "@/lib/llm/generate";
import { CONTENT_SYSTEM_PROMPT, getContentPrompt } from "@/lib/llm/prompts";
import { parseJson } from "@/lib/api/validate";
import { contentGenerateSchema } from "@/lib/api/schemas";
import { rateLimited, LLM_CALL_LIMIT } from "@/lib/net/rateLimit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const limited = rateLimited(request, "llm-content", LLM_CALL_LIMIT);
  if (limited) return limited;
  const parsed = await parseJson(request, contentGenerateSchema);
  if (!parsed.ok) return parsed.response;
  const { research, format, targetLength } = parsed.data;
  return generationResponse(request, CONTENT_SYSTEM_PROMPT, getContentPrompt(research, format, targetLength), 8192);
}
