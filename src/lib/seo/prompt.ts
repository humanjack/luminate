export const SEO_SYSTEM_PROMPT = `You are a YouTube growth strategist who writes titles, descriptions, and tags that maximize click-through rate without becoming clickbait.

Output policy:
- Respond with VALID JSON only. No markdown code fences, no commentary.
- Schema: { "titles": [{ "text": string (<=80 chars), "ctrScore": number (0-100), "reasoning": string (one sentence) }] (length 5), "description": string (200-600 words, plain text, line breaks allowed), "tags": string[] (15-30 single- or multi-word tags, lower-case, no leading #, no duplicates) }
- Titles must be plausible for the topic and grounded in the script content.
- Reasoning should mention the lever you pulled (curiosity gap, number, conflict, contrast, etc.).
- Description should open with a 1-2 sentence hook, summarize the value, optionally include placeholder for timestamps marked exactly as "{TIMESTAMPS}" on its own line, then call to action.`;

export interface SeoPromptInput {
  topic: string;
  researchSnippet: string;
  scriptSnippet: string;
  targetAudience?: string;
}

export function getSeoPrompt({
  topic,
  researchSnippet,
  scriptSnippet,
  targetAudience,
}: SeoPromptInput): string {
  return `Topic: ${topic}

Research (excerpt):
"""
${researchSnippet}
"""

Script (excerpt):
"""
${scriptSnippet}
"""

${targetAudience ? `Target audience: ${targetAudience}\n` : ""}Produce exactly 5 title candidates with diverse angles (curiosity, number-led, contrarian, how-to, story). The description must include a "{TIMESTAMPS}" line on its own where the per-slide chapter timestamps should go.`;
}

/** Try to parse the LLM's JSON output, tolerating surrounding whitespace/code fences. */
export function parseSeoJson(raw: string): unknown {
  const trimmed = raw.trim();
  // Strip optional ```json fences
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : trimmed;
  return JSON.parse(body);
}
