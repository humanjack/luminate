import { spawn, execSync } from "child_process";

export interface StreamingMessage {
  type: "text" | "done" | "error";
  content: string;
}

// Timeout for CLI operations (60 seconds)
const CLI_TIMEOUT_MS = 60000;

/**
 * Check if Claude CLI is available and accessible
 */
export function isClaudeCLIAvailable(): { available: boolean; error?: string } {
  try {
    execSync("which claude", { stdio: "pipe" });
    return { available: true };
  } catch {
    return {
      available: false,
      error: "Claude CLI not found. Please install it with: npm install -g @anthropic-ai/claude-code",
    };
  }
}

async function* runClaudeCLI(prompt: string): AsyncGenerator<StreamingMessage> {
  // Check if Claude CLI is available first
  const cliCheck = isClaudeCLIAvailable();
  if (!cliCheck.available) {
    yield { type: "error", content: cliCheck.error! };
    return;
  }

  // Create a queue to collect messages
  const messageQueue: StreamingMessage[] = [];
  let resolveWait: (() => void) | null = null;
  let isComplete = false;
  let buffer = "";
  let stderrBuffer = "";

  const enqueueMessage = (msg: StreamingMessage) => {
    messageQueue.push(msg);
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  };

  const processLine = (line: string): StreamingMessage | null => {
    if (!line.trim()) return null;

    try {
      const parsed = JSON.parse(line);

      // Handle content_block_delta with text_delta
      if (parsed.type === "content_block_delta") {
        if (parsed.delta?.type === "text_delta" && parsed.delta?.text) {
          return { type: "text", content: parsed.delta.text };
        }
        if (parsed.delta?.text) {
          return { type: "text", content: parsed.delta.text };
        }
      }

      // Handle assistant message with content blocks
      if (parsed.type === "assistant" && parsed.message?.content) {
        for (const block of parsed.message.content) {
          if (block.type === "text") {
            return { type: "text", content: block.text };
          }
        }
      }

      // Handle direct text in message
      if (parsed.type === "message" && parsed.content) {
        if (typeof parsed.content === "string") {
          return { type: "text", content: parsed.content };
        }
        if (Array.isArray(parsed.content)) {
          for (const block of parsed.content) {
            if (block.type === "text") {
              return { type: "text", content: block.text };
            }
          }
        }
      }

      // Handle result/completion events
      if (parsed.type === "result" || parsed.type === "message_stop") {
        return { type: "done", content: "" };
      }
      if (parsed.type === "message_delta" && parsed.delta?.stop_reason) {
        return { type: "done", content: "" };
      }
    } catch {
      // Not valid JSON - could be raw text output
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        return { type: "text", content: trimmed + "\n" };
      }
    }
    return null;
  };

  // Add --dangerously-skip-permissions flag to bypass permission prompts
  // This is required for automated/headless usage
  // --verbose is required when using --output-format stream-json with -p
  const child = spawn("claude", [
    "-p", prompt,
    "--output-format", "stream-json",
    "--dangerously-skip-permissions",
    "--verbose",
  ], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  // Set up timeout to kill process if it hangs
  const timeoutId = setTimeout(() => {
    if (!isComplete) {
      child.kill("SIGTERM");
      enqueueMessage({ type: "error", content: `Claude CLI timed out after ${CLI_TIMEOUT_MS / 1000} seconds` });
      isComplete = true;
      if (resolveWait) {
        resolveWait();
        resolveWait = null;
      }
    }
  }, CLI_TIMEOUT_MS);

  // Handle stdout data
  child.stdout?.on("data", (data: Buffer) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const message = processLine(line);
      if (message) enqueueMessage(message);
    }
  });

  // Handle stderr - send errors immediately for visibility
  child.stderr?.on("data", (data: Buffer) => {
    const stderrText = data.toString();
    stderrBuffer += stderrText;

    // If stderr contains permission/auth issues, send immediately
    if (stderrText.includes("permission") || stderrText.includes("auth") || stderrText.includes("error")) {
      console.error("[Claude CLI stderr]:", stderrText);
    }
  });

  // Handle spawn error
  child.on("error", (err: Error) => {
    clearTimeout(timeoutId);
    // Provide helpful error message for common spawn failures
    let errorMessage: string;
    if (err.message.includes("ENOENT")) {
      errorMessage = "Claude CLI not found. Please install it with: npm install -g @anthropic-ai/claude-code";
    } else {
      errorMessage = err.message;
    }
    enqueueMessage({ type: "error", content: errorMessage });
    isComplete = true;
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  });

  // Handle process close
  child.on("close", (code: number | null) => {
    // Clear the timeout since process completed
    clearTimeout(timeoutId);

    // Process remaining buffer
    if (buffer) {
      const message = processLine(buffer);
      if (message) enqueueMessage(message);
    }

    if (code !== 0 && stderrBuffer) {
      // Provide helpful error messages for common issues
      let errorMessage = stderrBuffer;
      if (stderrBuffer.includes("permission")) {
        errorMessage = `Claude CLI permission error: ${stderrBuffer}\n\nTry running with --dangerously-skip-permissions flag or check your Claude CLI authentication.`;
      } else if (stderrBuffer.includes("auth") || stderrBuffer.includes("login")) {
        errorMessage = `Claude CLI authentication required. Please run "claude auth" to authenticate.`;
      }
      enqueueMessage({ type: "error", content: errorMessage });
    } else if (code !== 0) {
      enqueueMessage({ type: "error", content: `Claude CLI exited with code ${code}` });
    }

    enqueueMessage({ type: "done", content: "" });
    isComplete = true;
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  });

  // Yield messages as they arrive
  while (true) {
    if (messageQueue.length > 0) {
      const msg = messageQueue.shift()!;
      yield msg;
      if (msg.type === "done" || msg.type === "error") {
        break;
      }
    } else if (isComplete) {
      break;
    } else {
      // Wait for more messages
      await new Promise<void>((resolve) => {
        resolveWait = resolve;
      });
    }
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
