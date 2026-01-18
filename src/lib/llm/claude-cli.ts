import { spawn } from "child_process";

export interface StreamingMessage {
  type: "text" | "done" | "error";
  content: string;
}

async function* runClaudeCLI(prompt: string): AsyncGenerator<StreamingMessage> {
  const child = spawn("claude", ["-p", prompt, "--output-format", "stream-json"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";

  const processLine = (line: string): StreamingMessage | null => {
    if (!line.trim()) return null;

    try {
      const parsed = JSON.parse(line);
      if (parsed.type === "assistant" && parsed.message?.content) {
        for (const block of parsed.message.content) {
          if (block.type === "text") {
            return { type: "text", content: block.text };
          }
        }
      } else if (parsed.type === "content_block_delta" && parsed.delta?.text) {
        return { type: "text", content: parsed.delta.text };
      } else if (parsed.type === "result") {
        return { type: "done", content: "" };
      }
    } catch {
      // Not valid JSON, might be partial line
    }
    return null;
  };

  try {
    for await (const chunk of child.stdout) {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const message = processLine(line);
        if (message) yield message;
      }
    }

    // Process remaining buffer
    if (buffer) {
      const message = processLine(buffer);
      if (message) yield message;
    }

    yield { type: "done", content: "" };
  } catch (error) {
    yield { type: "error", content: (error as Error).message };
  }
}

export async function* streamResearch(
  topic: string,
  depth: "quick" | "detailed" | "comprehensive"
): AsyncGenerator<StreamingMessage> {
  const depthInstructions = {
    quick: "Brief overview (300-500 words)",
    detailed: "Comprehensive overview (800-1200 words)",
    comprehensive: "In-depth analysis (1500-2500 words)",
  };

  const prompt = `Research the topic "${topic}" for a YouTube video.
${depthInstructions[depth]}

Include:
1. Key Points summary
2. Introduction
3. Main Content
4. Practical Applications
5. Sources

Use markdown formatting.`;

  yield* runClaudeCLI(prompt);
}

export async function* streamContent(
  research: string,
  format: "presentation" | "tutorial" | "explainer",
  targetLength: number
): AsyncGenerator<StreamingMessage> {
  const prompt = `Based on this research:

${research}

Create ${format} content for a ${targetLength}-minute YouTube video.
Use Slidev markdown format with "---" slide separators.
Target ${Math.ceil(targetLength / 2)} to ${Math.ceil(targetLength * 0.8)} slides.`;

  yield* runClaudeCLI(prompt);
}

export async function* streamScript(
  slideContent: string,
  slideIndex: number
): AsyncGenerator<StreamingMessage> {
  const prompt = `Write a video script for slide ${slideIndex + 1}:

${slideContent}

Write conversationally, 75-150 words, suitable for speaking aloud.
Return ONLY the script text.`;

  yield* runClaudeCLI(prompt);
}
