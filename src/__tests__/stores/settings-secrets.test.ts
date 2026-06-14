import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSettingsStore } from "@/stores/settings-store";
import { SECRET_SENTINEL } from "@/lib/api/secrets";

function resetStore() {
  useSettingsStore.setState({
    anthropicApiKey: "",
    openaiApiKey: "",
    secretConfigured: {},
  });
}

beforeEach(() => {
  resetStore();
});

describe("settings store secret redaction round-trip", () => {
  it("loadSettings records Configured flags and never puts the sentinel in an input", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        anthropicApiKey: SECRET_SENTINEL,
        anthropicApiKeyConfigured: true,
        theme: "dark",
      }),
    })) as unknown as typeof fetch;

    await useSettingsStore.getState().loadSettings();
    const s = useSettingsStore.getState();
    expect(s.anthropicApiKey).toBe(""); // sentinel never lands in the editable field
    expect(s.secretConfigured.anthropicApiKey).toBe(true);
    expect(s.theme).toBe("dark");
  });

  it("loadSettings does not clobber a real key already in state with the sentinel", async () => {
    useSettingsStore.setState({ anthropicApiKey: "sk-local-real" });
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ anthropicApiKey: SECRET_SENTINEL, anthropicApiKeyConfigured: true }),
    })) as unknown as typeof fetch;

    await useSettingsStore.getState().loadSettings();
    expect(useSettingsStore.getState().anthropicApiKey).toBe("sk-local-real");
  });

  it("saveSettings sends the sentinel for a configured-but-blank secret (so it is not wiped)", async () => {
    let sentBody: Record<string, unknown> = {};
    global.fetch = vi.fn(async (_url: unknown, init: { body: string }) => {
      sentBody = JSON.parse(init.body);
      return { ok: true } as Response;
    }) as unknown as typeof fetch;

    useSettingsStore.setState({ anthropicApiKey: "", secretConfigured: { anthropicApiKey: true } });
    await useSettingsStore.getState().saveSettings();
    expect(sentBody.anthropicApiKey).toBe(SECRET_SENTINEL);
  });

  it("saveSettings sends a real new value verbatim", async () => {
    let sentBody: Record<string, unknown> = {};
    global.fetch = vi.fn(async (_url: unknown, init: { body: string }) => {
      sentBody = JSON.parse(init.body);
      return { ok: true } as Response;
    }) as unknown as typeof fetch;

    useSettingsStore.setState({ anthropicApiKey: "sk-new", secretConfigured: { anthropicApiKey: true } });
    await useSettingsStore.getState().saveSettings();
    expect(sentBody.anthropicApiKey).toBe("sk-new");
  });
});
