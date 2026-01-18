import { describe, it, expect, vi, beforeEach, Mock } from "vitest";

// Use vi.hoisted to ensure mock is available before vi.mock is processed
const { mockStream, MockAnthropic } = vi.hoisted(() => {
  const mockStream = vi.fn();

  class MockAnthropic {
    _options: any;
    messages: { stream: typeof mockStream };

    constructor(config: any) {
      this._options = config;
      this.messages = { stream: mockStream };
    }
  }

  return { mockStream, MockAnthropic };
});

vi.mock("@anthropic-ai/sdk", () => ({
  default: MockAnthropic,
}));

import {
  getAnthropicClient,
  streamResearch,
  streamContent,
  streamScript,
  StreamingMessage,
} from "@/lib/llm/anthropic-client";
import Anthropic from "@anthropic-ai/sdk";

// Helper to collect all messages from an async generator
async function collectMessages(
  generator: AsyncGenerator<StreamingMessage>
): Promise<StreamingMessage[]> {
  const messages: StreamingMessage[] = [];
  for await (const msg of generator) {
    messages.push(msg);
  }
  return messages;
}

// Helper to create a mock stream
function createMockStream(events: any[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event;
      }
    },
  };
}

describe("getAnthropicClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the client cache by getting a new one with a unique key
  });

  it("should create a new client with the provided API key", () => {
    const client = getAnthropicClient("test-api-key-" + Date.now());
    expect(client).toBeDefined();
    expect((client as any)._options.apiKey).toContain("test-api-key");
  });

  it("should return cached client for same API key", () => {
    const key = "same-key-" + Date.now();
    const client1 = getAnthropicClient(key);
    const client2 = getAnthropicClient(key);
    expect(client1).toBe(client2);
  });

  it("should create new client for different API key", () => {
    const client1 = getAnthropicClient("key-1-" + Date.now());
    const client2 = getAnthropicClient("key-2-" + Date.now());
    expect(client1).not.toBe(client2);
  });
});

describe("streamResearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should yield text messages from streaming response", async () => {
    const mockEvents = [
      { type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "World" } },
    ];

    mockStream.mockResolvedValue(createMockStream(mockEvents));

    const messages = await collectMessages(
      streamResearch("test-key", "claude-3", "React Hooks", "quick")
    );

    expect(messages).toEqual([
      { type: "text", content: "Hello " },
      { type: "text", content: "World" },
      { type: "done", content: "" },
    ]);
  });

  it("should call stream with correct parameters for quick depth", async () => {
    mockStream.mockResolvedValue(createMockStream([]));

    await collectMessages(
      streamResearch("test-key-2", "claude-3-sonnet", "Test Topic", "quick")
    );

    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-3-sonnet",
        max_tokens: 4096,
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Test Topic"),
          }),
        ]),
      })
    );
  });

  it("should include depth-specific instructions", async () => {
    mockStream.mockResolvedValue(createMockStream([]));

    await collectMessages(
      streamResearch("test-key-3", "claude-3", "Topic", "detailed")
    );

    const call = mockStream.mock.calls[0][0];
    expect(call.messages[0].content).toContain("800-1200 words");
  });

  it("should yield error message on exception", async () => {
    mockStream.mockRejectedValue(new Error("API Error"));

    const messages = await collectMessages(
      streamResearch("test-key-4", "claude-3", "Topic", "quick")
    );

    expect(messages).toEqual([{ type: "error", content: "API Error" }]);
  });

  it("should ignore non-text events", async () => {
    const mockEvents = [
      { type: "message_start", message: {} },
      { type: "content_block_delta", delta: { type: "text_delta", text: "Text" } },
      { type: "message_stop" },
    ];

    mockStream.mockResolvedValue(createMockStream(mockEvents));

    const messages = await collectMessages(
      streamResearch("test-key-5", "claude-3", "Topic", "quick")
    );

    expect(messages).toEqual([
      { type: "text", content: "Text" },
      { type: "done", content: "" },
    ]);
  });
});

describe("streamContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should yield text messages from streaming response", async () => {
    const mockEvents = [
      { type: "content_block_delta", delta: { type: "text_delta", text: "# Slide 1" } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "\n---\n" } },
    ];

    mockStream.mockResolvedValue(createMockStream(mockEvents));

    const messages = await collectMessages(
      streamContent("content-key-1", "claude-3", "Research content", "presentation", 10)
    );

    expect(messages).toContainEqual({ type: "text", content: "# Slide 1" });
    expect(messages).toContainEqual({ type: "done", content: "" });
  });

  it("should include format-specific instructions", async () => {
    mockStream.mockResolvedValue(createMockStream([]));

    await collectMessages(
      streamContent("content-key-2", "claude-3", "Research", "tutorial", 10)
    );

    const call = mockStream.mock.calls[0][0];
    expect(call.messages[0].content).toContain("tutorial");
  });

  it("should calculate correct slide range", async () => {
    mockStream.mockResolvedValue(createMockStream([]));

    await collectMessages(
      streamContent("content-key-3", "claude-3", "Research", "presentation", 10)
    );

    const call = mockStream.mock.calls[0][0];
    // For 10 minutes: 5 to 8 slides
    expect(call.messages[0].content).toContain("5");
    expect(call.messages[0].content).toContain("8");
  });

  it("should yield error message on exception", async () => {
    mockStream.mockRejectedValue(new Error("Stream failed"));

    const messages = await collectMessages(
      streamContent("content-key-4", "claude-3", "Research", "presentation", 10)
    );

    expect(messages).toEqual([{ type: "error", content: "Stream failed" }]);
  });
});

describe("streamScript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should yield text messages from streaming response", async () => {
    const mockEvents = [
      {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Welcome to this video..." },
      },
    ];

    mockStream.mockResolvedValue(createMockStream(mockEvents));

    const messages = await collectMessages(
      streamScript("script-key-1", "claude-3", "# Introduction", 0)
    );

    expect(messages).toContainEqual({
      type: "text",
      content: "Welcome to this video...",
    });
    expect(messages).toContainEqual({ type: "done", content: "" });
  });

  it("should include correct slide number (1-indexed)", async () => {
    mockStream.mockResolvedValue(createMockStream([]));

    await collectMessages(
      streamScript("script-key-2", "claude-3", "Slide content", 4)
    );

    const call = mockStream.mock.calls[0][0];
    expect(call.messages[0].content).toContain("slide 5");
  });

  it("should use smaller max_tokens for scripts", async () => {
    mockStream.mockResolvedValue(createMockStream([]));

    await collectMessages(
      streamScript("script-key-3", "claude-3", "Content", 0)
    );

    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 1024,
      })
    );
  });

  it("should yield error message on exception", async () => {
    mockStream.mockRejectedValue(new Error("Script generation failed"));

    const messages = await collectMessages(
      streamScript("script-key-4", "claude-3", "Content", 0)
    );

    expect(messages).toEqual([
      { type: "error", content: "Script generation failed" },
    ]);
  });
});
