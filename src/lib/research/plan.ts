/**
 * Topic decomposition / planning (Phase 2, #46).
 *
 * Splits a research topic into focused sub-questions that guide breadth in the
 * agentic loop. The LLM call lives in `planResearch`; the parsing is a pure,
 * tolerant helper (`parseSubQuestions`) so it's unit-testable and robust to the
 * model wrapping the JSON array in prose or code fences.
 */
import type Anthropic from "@anthropic-ai/sdk";

import { ResearchDepth } from "./generate";

export function getPlanPrompt(topic: string, depth: ResearchDepth, count: number): string {
  return `You are planning research for a YouTube video on: "${topic}" (depth: ${depth}).

Break this topic into ${count} focused, non-overlapping sub-questions that together give thorough coverage. Each should be independently searchable.

Respond with ONLY a JSON array of strings, no prose, no code fence. Example:
["What is X?", "How does X work?", "What are the risks of X?"]`;
}

/**
 * Tolerantly extract a string array of sub-questions from model output.
 * Handles raw JSON, code-fenced JSON, and surrounding prose.
 */
export function parseSubQuestions(text: string): string[] {
  if (!text) return [];
  const candidates: string[] = [];

  // Prefer the first [...] block.
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    candidates.push(text.slice(start, end + 1));
  }
  candidates.push(text);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        const questions = parsed
          .filter((q): q is string => typeof q === "string")
          .map((q) => q.trim())
          .filter(Boolean);
        if (questions.length > 0) return questions;
      }
    } catch {
      /* try next candidate */
    }
  }
  return [];
}

export async function planResearch(
  client: Anthropic,
  model: string,
  topic: string,
  depth: ResearchDepth,
  count: number,
): Promise<string[]> {
  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: "user", content: getPlanPrompt(topic, depth, count) }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const questions = parseSubQuestions(text);
  // Fallback: if planning failed, research the topic as a single question.
  return questions.length > 0 ? questions.slice(0, count) : [topic];
}
