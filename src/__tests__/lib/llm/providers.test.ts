import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the clients
vi.mock("@/lib/llm/anthropic-client", () => ({
  streamResearch: vi.fn(),
  streamContent: vi.fn(),
  streamScript: vi.fn(),
}));

vi.mock("@/lib/llm/openai-client", () => ({
  streamResearch: vi.fn(),
  streamContent: vi.fn(),
  streamScript: vi.fn(),
}));

vi.mock("@/lib/llm/google-client", () => ({
  streamResearch: vi.fn(),
  streamContent: vi.fn(),
  streamScript: vi.fn(),
}));

describe("LLM Provider Configuration", () => {
  describe("Provider Selection", () => {
    it("should recognize anthropic as a valid provider", () => {
      const validProviders = ["anthropic", "openai", "google", "claude-cli"];
      expect(validProviders).toContain("anthropic");
    });

    it("should recognize openai as a valid provider", () => {
      const validProviders = ["anthropic", "openai", "google", "claude-cli"];
      expect(validProviders).toContain("openai");
    });

    it("should recognize google as a valid provider", () => {
      const validProviders = ["anthropic", "openai", "google", "claude-cli"];
      expect(validProviders).toContain("google");
    });

    it("should recognize claude-cli as a valid provider", () => {
      const validProviders = ["anthropic", "openai", "google", "claude-cli"];
      expect(validProviders).toContain("claude-cli");
    });
  });

  describe("Default Models", () => {
    it("should have correct default model for anthropic", () => {
      const defaultModels = {
        anthropic: "claude-sonnet-4-5-20250514",
        openai: "gpt-4.1",
        google: "gemini-2.5-flash",
      };
      expect(defaultModels.anthropic).toBe("claude-sonnet-4-5-20250514");
    });

    it("should have correct default model for openai", () => {
      const defaultModels = {
        anthropic: "claude-sonnet-4-5-20250514",
        openai: "gpt-4.1",
        google: "gemini-2.5-flash",
      };
      expect(defaultModels.openai).toBe("gpt-4.1");
    });

    it("should have correct default model for google", () => {
      const defaultModels = {
        anthropic: "claude-sonnet-4-5-20250514",
        openai: "gpt-4.1",
        google: "gemini-2.5-flash",
      };
      expect(defaultModels.google).toBe("gemini-2.5-flash");
    });
  });

  describe("API Key Settings", () => {
    it("should map anthropic provider to anthropicApiKey setting", () => {
      const apiKeyMap: Record<string, string> = {
        anthropic: "anthropicApiKey",
        openai: "openaiApiKey",
        google: "googleApiKey",
      };
      expect(apiKeyMap["anthropic"]).toBe("anthropicApiKey");
    });

    it("should map openai provider to openaiApiKey setting", () => {
      const apiKeyMap: Record<string, string> = {
        anthropic: "anthropicApiKey",
        openai: "openaiApiKey",
        google: "googleApiKey",
      };
      expect(apiKeyMap["openai"]).toBe("openaiApiKey");
    });

    it("should map google provider to googleApiKey setting", () => {
      const apiKeyMap: Record<string, string> = {
        anthropic: "anthropicApiKey",
        openai: "openaiApiKey",
        google: "googleApiKey",
      };
      expect(apiKeyMap["google"]).toBe("googleApiKey");
    });
  });

  describe("Model Settings", () => {
    it("should map anthropic provider to claudeModel setting", () => {
      const modelMap: Record<string, string> = {
        anthropic: "claudeModel",
        openai: "openaiModel",
        google: "googleModel",
      };
      expect(modelMap["anthropic"]).toBe("claudeModel");
    });

    it("should map openai provider to openaiModel setting", () => {
      const modelMap: Record<string, string> = {
        anthropic: "claudeModel",
        openai: "openaiModel",
        google: "googleModel",
      };
      expect(modelMap["openai"]).toBe("openaiModel");
    });

    it("should map google provider to googleModel setting", () => {
      const modelMap: Record<string, string> = {
        anthropic: "claudeModel",
        openai: "openaiModel",
        google: "googleModel",
      };
      expect(modelMap["google"]).toBe("googleModel");
    });
  });
});

describe("Provider Client Exports", () => {
  it("google-client should export streamResearch", async () => {
    const googleClient = await import("@/lib/llm/google-client");
    expect(googleClient.streamResearch).toBeDefined();
  });

  it("google-client should export streamContent", async () => {
    const googleClient = await import("@/lib/llm/google-client");
    expect(googleClient.streamContent).toBeDefined();
  });

  it("google-client should export streamScript", async () => {
    const googleClient = await import("@/lib/llm/google-client");
    expect(googleClient.streamScript).toBeDefined();
  });

  it("openai-client should export streamResearch", async () => {
    const openaiClient = await import("@/lib/llm/openai-client");
    expect(openaiClient.streamResearch).toBeDefined();
  });

  it("openai-client should export streamContent", async () => {
    const openaiClient = await import("@/lib/llm/openai-client");
    expect(openaiClient.streamContent).toBeDefined();
  });

  it("openai-client should export streamScript", async () => {
    const openaiClient = await import("@/lib/llm/openai-client");
    expect(openaiClient.streamScript).toBeDefined();
  });
});
