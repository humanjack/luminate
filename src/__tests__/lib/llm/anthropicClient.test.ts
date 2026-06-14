import { describe, it, expect, vi } from "vitest";

// Mock the SDK so we can assert the constructor options without the real client
// (which refuses to construct in the jsdom test env) and without a network dep.
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    opts: Record<string, unknown>;
    constructor(opts: Record<string, unknown>) {
      this.opts = opts;
    }
  },
}));

import { createAnthropicClient } from "@/lib/llm/anthropicClient";

describe("createAnthropicClient", () => {
  it("applies a bounded default timeout and retry count and passes the apiKey", () => {
    const client = createAnthropicClient("sk-test") as unknown as {
      opts: Record<string, unknown>;
    };
    expect(client.opts.apiKey).toBe("sk-test");
    expect(client.opts.timeout).toBe(120_000);
    expect(client.opts.maxRetries).toBe(2);
  });

  it("honors explicit overrides", () => {
    const client = createAnthropicClient("sk-test", {
      timeout: 5_000,
      maxRetries: 0,
    }) as unknown as { opts: Record<string, unknown> };
    expect(client.opts.timeout).toBe(5_000);
    expect(client.opts.maxRetries).toBe(0);
  });
});
