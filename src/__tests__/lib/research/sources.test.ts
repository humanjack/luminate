import { describe, expect, it } from "vitest";

import { extractSourcesFromContent } from "@/lib/research/sources";
import { AnthropicSearchProvider } from "@/lib/research/search";
import {
  GROUNDED_RESEARCH_SYSTEM_PROMPT,
  getGroundedResearchPrompt,
} from "@/lib/llm/prompts";

describe("extractSourcesFromContent", () => {
  it("pulls sources from web_search_tool_result blocks", () => {
    const content = [
      { type: "text", text: "Intro" },
      {
        type: "web_search_tool_result",
        content: [
          { type: "web_search_result", title: "MDN", url: "https://mdn.dev/a" },
          { type: "web_search_result", title: "Wiki", url: "https://wiki.org/b" },
        ],
      },
    ];
    const sources = extractSourcesFromContent(content);
    expect(sources).toHaveLength(2);
    expect(sources[0]).toEqual({ title: "MDN", url: "https://mdn.dev/a", snippet: undefined });
  });

  it("pulls cited snippets from text-block citations and enriches by URL", () => {
    const content = [
      {
        type: "web_search_tool_result",
        content: [{ type: "web_search_result", title: "MDN", url: "https://mdn.dev/a" }],
      },
      {
        type: "text",
        text: "Some claim.",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://mdn.dev/a",
            title: "MDN",
            cited_text: "the quoted evidence",
          },
        ],
      },
    ];
    const sources = extractSourcesFromContent(content);
    // Same URL → one deduped entry, enriched with the cited snippet.
    expect(sources).toHaveLength(1);
    expect(sources[0].snippet).toBe("the quoted evidence");
  });

  it("dedupes repeated URLs across blocks", () => {
    const content = [
      { type: "web_search_tool_result", content: [{ type: "web_search_result", title: "A", url: "https://x.dev" }] },
      { type: "web_search_tool_result", content: [{ type: "web_search_result", title: "A2", url: "https://x.dev" }] },
    ];
    expect(extractSourcesFromContent(content)).toHaveLength(1);
  });

  it("returns [] for non-array / empty input", () => {
    expect(extractSourcesFromContent(null)).toEqual([]);
    expect(extractSourcesFromContent("nope")).toEqual([]);
    expect(extractSourcesFromContent([])).toEqual([]);
  });

  it("AnthropicSearchProvider.extractSources delegates to the parser", () => {
    const provider = new AnthropicSearchProvider();
    const sources = provider.extractSources([
      { type: "web_search_tool_result", content: [{ type: "web_search_result", title: "T", url: "https://t.io" }] },
    ]);
    expect(sources).toEqual([{ title: "T", url: "https://t.io", snippet: undefined }]);
  });

  it("AnthropicSearchProvider tool definition targets the supported web_search version", () => {
    const tools = new AnthropicSearchProvider(5).getToolDefinitions() as Array<Record<string, unknown>>;
    expect(tools[0]).toMatchObject({ type: "web_search_20260209", name: "web_search", max_uses: 5 });
  });
});

describe("grounded research prompt", () => {
  it("forbids placeholder URLs and requires real citations", () => {
    expect(GROUNDED_RESEARCH_SYSTEM_PROMPT).toMatch(/NEVER invent|placeholder/i);
    expect(GROUNDED_RESEARCH_SYSTEM_PROMPT).toMatch(/web_search/);
    // Must not carry the legacy "use placeholder URLs if needed" instruction.
    expect(GROUNDED_RESEARCH_SYSTEM_PROMPT).not.toMatch(/use placeholder URLs if needed/i);
  });

  it("builds a depth-aware user prompt that asks for inline citations", () => {
    const prompt = getGroundedResearchPrompt("quantum computing", "detailed");
    expect(prompt).toContain("quantum computing");
    expect(prompt).toMatch(/inline \[title\]\(url\) citation/i);
    expect(prompt).not.toMatch(/placeholder/i);
  });
});
