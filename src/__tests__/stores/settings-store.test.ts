import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSettingsStore } from "@/stores/settings-store";

// Helper to reset the store
const resetStore = () => {
  useSettingsStore.setState({
    llmProvider: "anthropic",
    anthropicApiKey: "",
    claudeModel: "claude-sonnet-4-5-20250514",
    speechProvider: "speechsuper",
    speechSuperApiKey: "",
    speechSuperAppId: "",
    elsaApiKey: "",
    youtubeConnected: false,
    youtubeChannelName: "",
    theme: "system",
    autoSave: true,
    autoSaveInterval: 30,
    defaultRecordingMode: "per-slide",
    showWaveform: true,
    teleprompterSpeed: 150,
    teleprompterFontSize: 24,
    defaultResolution: "1920x1080",
    defaultTransition: "fade",
  });
};

describe("useSettingsStore", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have correct default LLM settings", () => {
      const state = useSettingsStore.getState();
      expect(state.llmProvider).toBe("anthropic");
      expect(state.anthropicApiKey).toBe("");
      expect(state.claudeModel).toBe("claude-sonnet-4-5-20250514");
    });

    it("should have correct default speech settings", () => {
      const state = useSettingsStore.getState();
      expect(state.speechProvider).toBe("speechsuper");
      expect(state.speechSuperApiKey).toBe("");
      expect(state.speechSuperAppId).toBe("");
      expect(state.elsaApiKey).toBe("");
    });

    it("should have correct default YouTube settings", () => {
      const state = useSettingsStore.getState();
      expect(state.youtubeConnected).toBe(false);
      expect(state.youtubeChannelName).toBe("");
    });

    it("should have correct default UI preferences", () => {
      const state = useSettingsStore.getState();
      expect(state.theme).toBe("system");
      expect(state.autoSave).toBe(true);
      expect(state.autoSaveInterval).toBe(30);
    });

    it("should have correct default recording preferences", () => {
      const state = useSettingsStore.getState();
      expect(state.defaultRecordingMode).toBe("per-slide");
      expect(state.showWaveform).toBe(true);
      expect(state.teleprompterSpeed).toBe(150);
      expect(state.teleprompterFontSize).toBe(24);
    });

    it("should have correct default video preferences", () => {
      const state = useSettingsStore.getState();
      expect(state.defaultResolution).toBe("1920x1080");
      expect(state.defaultTransition).toBe("fade");
    });
  });

  describe("LLM settings", () => {
    it("should set LLM provider", () => {
      useSettingsStore.getState().setLLMProvider("claude-cli");
      expect(useSettingsStore.getState().llmProvider).toBe("claude-cli");

      useSettingsStore.getState().setLLMProvider("anthropic");
      expect(useSettingsStore.getState().llmProvider).toBe("anthropic");
    });

    it("should set Anthropic API key", () => {
      useSettingsStore.getState().setAnthropicApiKey("sk-test-key");
      expect(useSettingsStore.getState().anthropicApiKey).toBe("sk-test-key");
    });

    it("should set Claude model", () => {
      useSettingsStore.getState().setClaudeModel("claude-3-opus");
      expect(useSettingsStore.getState().claudeModel).toBe("claude-3-opus");
    });
  });

  describe("Speech settings", () => {
    it("should set speech provider", () => {
      useSettingsStore.getState().setSpeechProvider("elsa");
      expect(useSettingsStore.getState().speechProvider).toBe("elsa");

      useSettingsStore.getState().setSpeechProvider("speechsuper");
      expect(useSettingsStore.getState().speechProvider).toBe("speechsuper");
    });

    it("should set SpeechSuper credentials", () => {
      useSettingsStore
        .getState()
        .setSpeechSuperCredentials("api-key-123", "app-id-456");
      const state = useSettingsStore.getState();
      expect(state.speechSuperApiKey).toBe("api-key-123");
      expect(state.speechSuperAppId).toBe("app-id-456");
    });

    it("should set ELSA API key", () => {
      useSettingsStore.getState().setElsaApiKey("elsa-key-789");
      expect(useSettingsStore.getState().elsaApiKey).toBe("elsa-key-789");
    });
  });

  describe("YouTube settings", () => {
    it("should set YouTube connection status", () => {
      useSettingsStore.getState().setYouTubeConnection(true, "My Channel");
      const state = useSettingsStore.getState();
      expect(state.youtubeConnected).toBe(true);
      expect(state.youtubeChannelName).toBe("My Channel");
    });

    it("should disconnect YouTube", () => {
      useSettingsStore.getState().setYouTubeConnection(true, "My Channel");
      useSettingsStore.getState().setYouTubeConnection(false);
      const state = useSettingsStore.getState();
      expect(state.youtubeConnected).toBe(false);
      expect(state.youtubeChannelName).toBe("");
    });

    it("should handle missing channel name", () => {
      useSettingsStore.getState().setYouTubeConnection(true);
      expect(useSettingsStore.getState().youtubeChannelName).toBe("");
    });
  });

  describe("UI preferences", () => {
    it("should set theme", () => {
      useSettingsStore.getState().setTheme("dark");
      expect(useSettingsStore.getState().theme).toBe("dark");

      useSettingsStore.getState().setTheme("light");
      expect(useSettingsStore.getState().theme).toBe("light");

      useSettingsStore.getState().setTheme("system");
      expect(useSettingsStore.getState().theme).toBe("system");
    });

    it("should set auto-save enabled", () => {
      useSettingsStore.getState().setAutoSave(false);
      expect(useSettingsStore.getState().autoSave).toBe(false);

      useSettingsStore.getState().setAutoSave(true);
      expect(useSettingsStore.getState().autoSave).toBe(true);
    });

    it("should set auto-save interval", () => {
      useSettingsStore.getState().setAutoSave(true, 60);
      const state = useSettingsStore.getState();
      expect(state.autoSave).toBe(true);
      expect(state.autoSaveInterval).toBe(60);
    });

    it("should not change interval when not provided", () => {
      useSettingsStore.getState().setAutoSave(true, 60);
      useSettingsStore.getState().setAutoSave(false);
      expect(useSettingsStore.getState().autoSaveInterval).toBe(60);
    });
  });

  describe("Recording preferences", () => {
    it("should set recording mode", () => {
      useSettingsStore
        .getState()
        .setRecordingPreferences({ defaultRecordingMode: "continuous" });
      expect(useSettingsStore.getState().defaultRecordingMode).toBe(
        "continuous"
      );
    });

    it("should set waveform visibility", () => {
      useSettingsStore.getState().setRecordingPreferences({ showWaveform: false });
      expect(useSettingsStore.getState().showWaveform).toBe(false);
    });

    it("should set teleprompter speed", () => {
      useSettingsStore
        .getState()
        .setRecordingPreferences({ teleprompterSpeed: 200 });
      expect(useSettingsStore.getState().teleprompterSpeed).toBe(200);
    });

    it("should set teleprompter font size", () => {
      useSettingsStore
        .getState()
        .setRecordingPreferences({ teleprompterFontSize: 32 });
      expect(useSettingsStore.getState().teleprompterFontSize).toBe(32);
    });

    it("should set multiple recording preferences at once", () => {
      useSettingsStore.getState().setRecordingPreferences({
        defaultRecordingMode: "continuous",
        showWaveform: false,
        teleprompterSpeed: 180,
        teleprompterFontSize: 28,
      });
      const state = useSettingsStore.getState();
      expect(state.defaultRecordingMode).toBe("continuous");
      expect(state.showWaveform).toBe(false);
      expect(state.teleprompterSpeed).toBe(180);
      expect(state.teleprompterFontSize).toBe(28);
    });
  });

  describe("Video preferences", () => {
    it("should set resolution", () => {
      useSettingsStore
        .getState()
        .setVideoPreferences({ defaultResolution: "2560x1440" });
      expect(useSettingsStore.getState().defaultResolution).toBe("2560x1440");
    });

    it("should set transition", () => {
      useSettingsStore
        .getState()
        .setVideoPreferences({ defaultTransition: "slide" });
      expect(useSettingsStore.getState().defaultTransition).toBe("slide");

      useSettingsStore
        .getState()
        .setVideoPreferences({ defaultTransition: "none" });
      expect(useSettingsStore.getState().defaultTransition).toBe("none");
    });

    it("should set multiple video preferences at once", () => {
      useSettingsStore.getState().setVideoPreferences({
        defaultResolution: "1280x720",
        defaultTransition: "none",
      });
      const state = useSettingsStore.getState();
      expect(state.defaultResolution).toBe("1280x720");
      expect(state.defaultTransition).toBe("none");
    });
  });

  describe("hasValidLLMConfig", () => {
    it("should return false for Anthropic without API key", () => {
      useSettingsStore.getState().setLLMProvider("anthropic");
      useSettingsStore.getState().setAnthropicApiKey("");
      expect(useSettingsStore.getState().hasValidLLMConfig()).toBe(false);
    });

    it("should return true for Anthropic with API key", () => {
      useSettingsStore.getState().setLLMProvider("anthropic");
      useSettingsStore.getState().setAnthropicApiKey("sk-valid-key");
      expect(useSettingsStore.getState().hasValidLLMConfig()).toBe(true);
    });

    it("should return true for Claude CLI (no API key needed)", () => {
      useSettingsStore.getState().setLLMProvider("claude-cli");
      useSettingsStore.getState().setAnthropicApiKey("");
      expect(useSettingsStore.getState().hasValidLLMConfig()).toBe(true);
    });
  });

  describe("hasValidSpeechConfig", () => {
    it("should return false for SpeechSuper without credentials", () => {
      useSettingsStore.getState().setSpeechProvider("speechsuper");
      useSettingsStore.getState().setSpeechSuperCredentials("", "");
      expect(useSettingsStore.getState().hasValidSpeechConfig()).toBe(false);
    });

    it("should return false for SpeechSuper with partial credentials", () => {
      useSettingsStore.getState().setSpeechProvider("speechsuper");
      useSettingsStore.getState().setSpeechSuperCredentials("api-key", "");
      expect(useSettingsStore.getState().hasValidSpeechConfig()).toBe(false);

      useSettingsStore.getState().setSpeechSuperCredentials("", "app-id");
      expect(useSettingsStore.getState().hasValidSpeechConfig()).toBe(false);
    });

    it("should return true for SpeechSuper with full credentials", () => {
      useSettingsStore.getState().setSpeechProvider("speechsuper");
      useSettingsStore.getState().setSpeechSuperCredentials("api-key", "app-id");
      expect(useSettingsStore.getState().hasValidSpeechConfig()).toBe(true);
    });

    it("should return false for ELSA without API key", () => {
      useSettingsStore.getState().setSpeechProvider("elsa");
      useSettingsStore.getState().setElsaApiKey("");
      expect(useSettingsStore.getState().hasValidSpeechConfig()).toBe(false);
    });

    it("should return true for ELSA with API key", () => {
      useSettingsStore.getState().setSpeechProvider("elsa");
      useSettingsStore.getState().setElsaApiKey("elsa-key");
      expect(useSettingsStore.getState().hasValidSpeechConfig()).toBe(true);
    });
  });

  describe("loadSettings", () => {
    it("should load settings from API", async () => {
      const mockSettings = {
        llmProvider: "claude-cli",
        anthropicApiKey: "loaded-key",
        theme: "dark",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSettings),
      });

      await useSettingsStore.getState().loadSettings();

      expect(global.fetch).toHaveBeenCalledWith("/api/settings");
      expect(useSettingsStore.getState().llmProvider).toBe("claude-cli");
      expect(useSettingsStore.getState().anthropicApiKey).toBe("loaded-key");
      expect(useSettingsStore.getState().theme).toBe("dark");
    });

    it("should handle API errors gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useSettingsStore.getState().loadSettings();

      // Should not throw, state should remain unchanged
      expect(useSettingsStore.getState().llmProvider).toBe("anthropic");

      consoleSpy.mockRestore();
    });

    it("should handle network errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useSettingsStore.getState().loadSettings();

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("saveSettings", () => {
    it("should save settings to API", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      useSettingsStore.getState().setLLMProvider("claude-cli");
      useSettingsStore.getState().setTheme("dark");

      await useSettingsStore.getState().saveSettings();

      expect(global.fetch).toHaveBeenCalledWith("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      });

      const savedBody = JSON.parse(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      );
      expect(savedBody.llmProvider).toBe("claude-cli");
      expect(savedBody.theme).toBe("dark");
    });

    it("should handle save errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Save failed"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useSettingsStore.getState().saveSettings();

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
