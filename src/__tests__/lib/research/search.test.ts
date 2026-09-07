import { describe, expect, it } from "vitest";

import {
  AnthropicSearchProvider,
  BraveSearchProvider,
  getSearchProvider,
  MissingSearchKeyError,
  SearchProviderNotImplementedError,
  TavilySearchProvider,
} from "@/lib/research/search";
import {
  resolveSearchProvider,
  shouldUseInProcessResearch,
  type ResearchGenerationConfig,
} from "@/lib/research/generate";

const baseConfig: ResearchGenerationConfig = {
  enableWebResearch: false,
  searchProvider: "anthropic",
  maxSources: 8,
  maxSearchIterations: 2,
};

describe("research/search factory", () => {
  it("returns the Anthropic provider by default (no extra key required)", () => {
    const provider = getSearchProvider({ searchProvider: "anthropic" });
    expect(provider).toBeInstanceOf(AnthropicSearchProvider);
    expect(provider.id).toBe("anthropic");
    expect(provider.mode).toBe("native-tool");
  });

  it("Anthropic provider exposes web_search tool definitions", () => {
    const provider = getSearchProvider({ searchProvider: "anthropic", maxSources: 5 });
    const tools = provider.getToolDefinitions();
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({ name: "web_search", max_uses: 5 });
  });

  it("returns the Tavily provider when a key is present", () => {
    const provider = getSearchProvider({ searchProvider: "tavily", tavilyApiKey: "tvly-x" });
    expect(provider).toBeInstanceOf(TavilySearchProvider);
    expect(provider.mode).toBe("search-api");
  });

  it("returns the Brave provider when a key is present", () => {
    const provider = getSearchProvider({ searchProvider: "brave", braveApiKey: "BSA-x" });
    expect(provider).toBeInstanceOf(BraveSearchProvider);
  });

  it("throws MissingSearchKeyError when Tavily is selected without a key", () => {
    expect(() => getSearchProvider({ searchProvider: "tavily" })).toThrow(MissingSearchKeyError);
  });

  it("throws MissingSearchKeyError when Brave is selected without a key", () => {
    expect(() => getSearchProvider({ searchProvider: "brave" })).toThrow(MissingSearchKeyError);
  });

  it("Anthropic standalone search() is not a supported capability", async () => {
    const provider = getSearchProvider({ searchProvider: "anthropic" });
    await expect(provider.search("x")).rejects.toBeInstanceOf(SearchProviderNotImplementedError);
  });
});

describe("research/generate seam", () => {
  it("in-process research is gated off by default", () => {
    expect(shouldUseInProcessResearch(baseConfig)).toBe(false);
  });

  it("in-process research turns on with the flag", () => {
    expect(shouldUseInProcessResearch({ ...baseConfig, enableWebResearch: true })).toBe(true);
  });

  it("resolveSearchProvider honors the configured provider", () => {
    const provider = resolveSearchProvider({ ...baseConfig, searchProvider: "anthropic" });
    expect(provider.id).toBe("anthropic");
  });

  it("resolveSearchProvider surfaces the missing-key error for search-api providers", () => {
    expect(() =>
      resolveSearchProvider({ ...baseConfig, searchProvider: "tavily" }),
    ).toThrow(MissingSearchKeyError);
  });
});
