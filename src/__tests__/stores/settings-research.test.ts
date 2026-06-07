import { beforeEach, describe, expect, it } from "vitest";

import { useSettingsStore } from "@/stores/settings-store";

describe("settings-store research preferences", () => {
  beforeEach(() => {
    // Reset the research slice to known defaults between tests.
    useSettingsStore.setState({
      enableWebResearch: false,
      searchProvider: "anthropic",
      maxSources: 8,
      maxSearchIterations: 2,
      tavilyApiKey: "",
      braveApiKey: "",
    });
  });

  it("has grounded research off by default with the Anthropic provider", () => {
    const s = useSettingsStore.getState();
    expect(s.enableWebResearch).toBe(false);
    expect(s.searchProvider).toBe("anthropic");
    expect(s.maxSources).toBe(8);
    expect(s.maxSearchIterations).toBe(2);
  });

  it("setResearchPreferences performs a partial update", () => {
    useSettingsStore.getState().setResearchPreferences({
      enableWebResearch: true,
      searchProvider: "tavily",
      tavilyApiKey: "tvly-abc",
    });
    const s = useSettingsStore.getState();
    expect(s.enableWebResearch).toBe(true);
    expect(s.searchProvider).toBe("tavily");
    expect(s.tavilyApiKey).toBe("tvly-abc");
    // Untouched fields keep their values.
    expect(s.maxSources).toBe(8);
    expect(s.braveApiKey).toBe("");
  });
});
