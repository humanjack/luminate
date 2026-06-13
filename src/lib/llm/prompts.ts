export const RESEARCH_SYSTEM_PROMPT = `You are a research assistant specializing in creating educational content for YouTube videos.
Your task is to research topics thoroughly and present information in a clear, engaging way.
Always cite sources when possible and provide factual, accurate information.
Format your response in markdown with clear headings and bullet points.
Include a "Key Points" section at the beginning and a "Sources" section at the end.`;

export const CONTENT_SYSTEM_PROMPT = `You are a content creator specializing in YouTube video presentations.
Create engaging, well-structured content suitable for video slides.
Use markdown formatting for the output.
Each slide should be clearly marked with "---" separators (Slidev format).`;

export const SCRIPT_SYSTEM_PROMPT = `You are a script writer for YouTube videos.
Write natural, conversational scripts that are easy to read aloud.
Avoid overly formal language - be engaging and personable.
The script should flow naturally when spoken.`;

export function getResearchPrompt(
  topic: string,
  depth: "quick" | "detailed" | "comprehensive"
): string {
  const depthInstructions = {
    quick: "Provide a brief overview in about 300-500 words.",
    detailed: "Provide a comprehensive overview in about 800-1200 words with multiple sections.",
    comprehensive: "Provide an in-depth analysis in about 1500-2500 words with extensive detail, examples, and multiple perspectives.",
  };

  return `Research the following topic for a YouTube video: "${topic}"

${depthInstructions[depth]}

Structure your research as follows:
1. **Key Points** - A bulleted summary of the main takeaways
2. **Introduction** - Brief context and why this topic matters
3. **Main Content** - Detailed exploration of the topic with relevant facts and insights
4. **Practical Applications** - How viewers can apply this knowledge
5. **Sources** - List any referenced materials (use placeholder URLs if needed)

Make the content engaging and suitable for video narration.`;
}

// --- Grounded research (Phase 1, #45) ----------------------------------------
// Used when web research is enabled. Unlike RESEARCH_SYSTEM_PROMPT, this REQUIRES
// real, retrieved sources and forbids fabricated/placeholder URLs.

export const GROUNDED_RESEARCH_SYSTEM_PROMPT = `You are a research assistant creating educational content for YouTube videos.
You have a web_search tool. Use it to ground every factual claim in real, current sources.

Rules:
- Search the web before writing. Do not rely on memory for facts, names, dates, numbers, or recent events.
- Cite sources inline as markdown links [source title](https://real-url) next to the claims they support. Use ONLY URLs returned by your searches.
- NEVER invent, guess, or use placeholder URLs. If you cannot find a source for a claim, either drop the claim or clearly mark it as unverified.
- Prefer primary and authoritative sources over aggregators.
- Format the response in markdown with clear headings and bullet points.
- Begin with a "Key Points" section and end with a "Sources" section listing every cited URL.`;

export function getGroundedResearchPrompt(
  topic: string,
  depth: "quick" | "detailed" | "comprehensive"
): string {
  const depthInstructions = {
    quick: "Provide a brief, well-sourced overview in about 300-500 words.",
    detailed:
      "Provide a comprehensive, well-sourced overview in about 800-1200 words with multiple sections.",
    comprehensive:
      "Provide an in-depth, well-sourced analysis in about 1500-2500 words with extensive detail, examples, and multiple perspectives.",
  };

  return `Research the following topic for a YouTube video: "${topic}"

${depthInstructions[depth]}

Search the web first, then structure your research as follows:
1. **Key Points** - A bulleted summary of the main takeaways (each with an inline source link)
2. **Introduction** - Brief context and why this topic matters
3. **Main Content** - Detailed exploration with relevant facts and insights, each cited inline
4. **Practical Applications** - How viewers can apply this knowledge
5. **Sources** - The list of real URLs you cited

Every factual claim must carry an inline [title](url) citation to a source you actually retrieved. Make the content engaging and suitable for video narration.`;
}

export function getContentPrompt(
  research: string,
  format: "presentation" | "tutorial" | "explainer",
  targetLength: number
): string {
  const formatInstructions = {
    presentation: "Create slide-based presentation content with clear sections for each slide.",
    tutorial: "Create step-by-step tutorial content with practical instructions.",
    explainer: "Create educational explainer content that breaks down complex concepts.",
  };

  return `Based on this research:

${research}

Create ${format} content for a ${targetLength}-minute YouTube video.

${formatInstructions[format]}

Format the content using Slidev markdown syntax:
- Use "---" to separate slides
- Use "# " for slide titles
- Use bullet points for key points
- Include speaker notes after each slide using HTML comments <!-- notes -->

Target approximately ${Math.ceil(targetLength / 2)} to ${Math.ceil(targetLength * 0.8)} slides.
Each slide should have 3-5 bullet points maximum for readability.`;
}

export function getScriptPrompt(slideContent: string, slideIndex: number): string {
  return `Write a video script for the following slide content:

${slideContent}

This is slide ${slideIndex + 1} of the presentation.

Guidelines:
- Write in a conversational tone
- Include natural transitions
- Aim for about 30-60 seconds of speaking time (75-150 words)
- Don't just read the bullet points - expand on them
- Include brief pauses indicated by "..."

Return ONLY the script text, no additional formatting.`;
}
