import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(apiKey: string): Anthropic {
  if (!client || (client as any)._options?.apiKey !== apiKey) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface StreamingMessage {
  type: "text" | "done" | "error";
  content: string;
}

export async function* streamResearch(
  apiKey: string,
  model: string,
  topic: string,
  depth: "quick" | "detailed" | "comprehensive"
): AsyncGenerator<StreamingMessage> {
  const client = getAnthropicClient(apiKey);

  const depthInstructions = {
    quick: "Provide a brief overview in about 300-500 words.",
    detailed: "Provide a comprehensive overview in about 800-1200 words with multiple sections.",
    comprehensive: "Provide an in-depth analysis in about 1500-2500 words with extensive detail, examples, and multiple perspectives.",
  };

  const systemPrompt = `You are a research assistant specializing in creating educational content for YouTube videos.
Your task is to research topics thoroughly and present information in a clear, engaging way.
Always cite sources when possible and provide factual, accurate information.
Format your response in markdown with clear headings and bullet points.
Include a "Key Points" section at the beginning and a "Sources" section at the end.`;

  const userPrompt = `Research the following topic for a YouTube video: "${topic}"

${depthInstructions[depth]}

Structure your research as follows:
1. **Key Points** - A bulleted summary of the main takeaways
2. **Introduction** - Brief context and why this topic matters
3. **Main Content** - Detailed exploration of the topic with relevant facts and insights
4. **Practical Applications** - How viewers can apply this knowledge
5. **Sources** - List any referenced materials (use placeholder URLs if needed)

Make the content engaging and suitable for video narration.`;

  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "text", content: event.delta.text };
      }
    }

    yield { type: "done", content: "" };
  } catch (error) {
    yield { type: "error", content: (error as Error).message };
  }
}

export async function* streamContent(
  apiKey: string,
  model: string,
  research: string,
  format: "presentation" | "tutorial" | "explainer",
  targetLength: number
): AsyncGenerator<StreamingMessage> {
  const client = getAnthropicClient(apiKey);

  const formatInstructions = {
    presentation: "Create slide-based presentation content with clear sections for each slide.",
    tutorial: "Create step-by-step tutorial content with practical instructions.",
    explainer: "Create educational explainer content that breaks down complex concepts.",
  };

  const systemPrompt = `You are a content creator specializing in YouTube video presentations.
Create engaging, well-structured content suitable for video slides.
Use markdown formatting for the output.
Each slide should be clearly marked with "---" separators (Slidev format).`;

  const userPrompt = `Based on this research:

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

  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "text", content: event.delta.text };
      }
    }

    yield { type: "done", content: "" };
  } catch (error) {
    yield { type: "error", content: (error as Error).message };
  }
}

export async function* streamScript(
  apiKey: string,
  model: string,
  slideContent: string,
  slideIndex: number
): AsyncGenerator<StreamingMessage> {
  const client = getAnthropicClient(apiKey);

  const systemPrompt = `You are a script writer for YouTube videos.
Write natural, conversational scripts that are easy to read aloud.
Avoid overly formal language - be engaging and personable.
The script should flow naturally when spoken.`;

  const userPrompt = `Write a video script for the following slide content:

${slideContent}

This is slide ${slideIndex + 1} of the presentation.

Guidelines:
- Write in a conversational tone
- Include natural transitions
- Aim for about 30-60 seconds of speaking time (75-150 words)
- Don't just read the bullet points - expand on them
- Include brief pauses indicated by "..."

Return ONLY the script text, no additional formatting.`;

  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "text", content: event.delta.text };
      }
    }

    yield { type: "done", content: "" };
  } catch (error) {
    yield { type: "error", content: (error as Error).message };
  }
}
