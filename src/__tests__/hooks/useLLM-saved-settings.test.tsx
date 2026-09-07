import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLLM, type StreamingMessage } from "@/hooks/useLLM";
import { useSettingsStore } from "@/stores/settings-store";
import { SECRET_SENTINEL } from "@/lib/api/secrets";

beforeEach(() => {
  useSettingsStore.setState({ llmProvider: "openai", openaiApiKey: "", anthropicApiKey: "", googleApiKey: "", secretConfigured: {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("server-resolved generation eligibility", () => {
  it.each(["openai", "anthropic", "google"] as const)("generates with a saved %s key after fresh-browser settings hydration", async (provider) => {
    const key = `${provider}ApiKey`;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ llmProvider: provider, [key]: SECRET_SENTINEL, [`${key}Configured`]: true }))
      .mockResolvedValueOnce(new Response('data: {"type":"text","content":"Script"}\n\ndata: {"type":"done","content":""}\n\n')));
    await useSettingsStore.getState().loadSettings();
    // Server credentials enable the main workflow without enabling callers
    // which still need to send a raw key, such as the agent and SEO copilot.
    expect(useSettingsStore.getState().hasValidLLMConfig()).toBe(false);
    const { result } = renderHook(() => useLLM());
    expect(result.current.hasValidConfig).toBe(true);
    const messages: StreamingMessage[] = [];
    await act(async () => {
      for await (const message of result.current.streamScript("Slide", 0)) messages.push(message);
    });
    expect(messages).toContainEqual({ type: "text", content: "Script" });
    expect(fetch).toHaveBeenLastCalledWith("/api/llm/script", expect.objectContaining({ body: JSON.stringify({ slideContent: "Slide", slideIndex: 0 }) }));
  });

  it("does not use another provider's configured key or enable unsupported CLI generation", () => {
    useSettingsStore.setState({ llmProvider: "google", secretConfigured: { openaiApiKey: true } });
    const { result, rerender } = renderHook(() => useLLM());
    expect(result.current.hasValidConfig).toBe(false);
    act(() => useSettingsStore.setState({ llmProvider: "claude-cli", secretConfigured: { anthropicApiKey: true } }));
    rerender();
    expect(result.current.hasValidConfig).toBe(false);
  });

  it("acknowledges a newly saved key immediately and retains eligibility after clearing the local copy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true })));
    useSettingsStore.setState({ openaiApiKey: "new-key" });
    await useSettingsStore.getState().saveSettings();
    expect(useSettingsStore.getState().secretConfigured.openaiApiKey).toBe(true);
    useSettingsStore.setState({ openaiApiKey: "" });
    expect(useSettingsStore.getState().hasValidServerLLMConfig()).toBe(true);
    expect(useSettingsStore.getState().hasValidLLMConfig()).toBe(false);
    await useSettingsStore.getState().saveSettings();
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string).openaiApiKey).toBe(SECRET_SENTINEL);
  });

  it("does not mark a rejected save as configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      useSettingsStore.setState({ openaiApiKey: "rejected-key" });
      await useSettingsStore.getState().saveSettings();
      expect(useSettingsStore.getState().secretConfigured.openaiApiKey).not.toBe(true);
    } finally { log.mockRestore(); }
  });
});
