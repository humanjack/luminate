import { NextRequest } from "next/server";
import { generationResponse } from "@/lib/llm/generate";
import { SCRIPT_SYSTEM_PROMPT, getScriptPrompt } from "@/lib/llm/prompts";
import { parseJson } from "@/lib/api/validate";
import { scriptGenerateSchema } from "@/lib/api/schemas";
import { rateLimited, LLM_CALL_LIMIT } from "@/lib/net/rateLimit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const limited = rateLimited(request, "llm-script", LLM_CALL_LIMIT);
  if (limited) return limited;
  const parsed = await parseJson(request, scriptGenerateSchema);
  if (!parsed.ok) return parsed.response;
  const { slideContent, slideIndex } = parsed.data;
  return generationResponse(request, SCRIPT_SYSTEM_PROMPT, getScriptPrompt(slideContent, slideIndex), 2048);
}
