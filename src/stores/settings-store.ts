import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LLMProvider = "anthropic" | "openai" | "google" | "claude-cli";
export type SpeechProvider = "speechsuper" | "elsa";

interface SettingsState {
  // LLM Settings
  llmProvider: LLMProvider;
  anthropicApiKey: string;
  claudeModel: string;
  openaiApiKey: string;
  openaiModel: string;
  googleApiKey: string;
  googleModel: string;

  // Speech Analysis Settings
  speechProvider: SpeechProvider;
  speechSuperApiKey: string;
  speechSuperAppId: string;
  elsaApiKey: string;

  // YouTube Settings
  youtubeConnected: boolean;
  youtubeChannelName: string;

  // UI Preferences
  theme: "light" | "dark" | "system";
  autoSave: boolean;
  autoSaveInterval: number; // seconds

  // Recording Preferences
  defaultRecordingMode: "per-slide" | "continuous";
  showWaveform: boolean;
  teleprompterSpeed: number; // words per minute
  teleprompterFontSize: number;

  // Video Export Preferences
  defaultResolution: "1280x720" | "1920x1080" | "2560x1440";
  defaultTransition: "none" | "fade" | "slide";

  // Actions
  setLLMProvider: (provider: LLMProvider) => void;
  setAnthropicApiKey: (key: string) => void;
  setClaudeModel: (model: string) => void;
  setOpenAIApiKey: (key: string) => void;
  setOpenAIModel: (model: string) => void;
  setGoogleApiKey: (key: string) => void;
  setGoogleModel: (model: string) => void;
  setSpeechProvider: (provider: SpeechProvider) => void;
  setSpeechSuperCredentials: (apiKey: string, appId: string) => void;
  setElsaApiKey: (key: string) => void;
  setYouTubeConnection: (connected: boolean, channelName?: string) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setAutoSave: (enabled: boolean, interval?: number) => void;
  setRecordingPreferences: (prefs: Partial<Pick<SettingsState, "defaultRecordingMode" | "showWaveform" | "teleprompterSpeed" | "teleprompterFontSize">>) => void;
  setVideoPreferences: (prefs: Partial<Pick<SettingsState, "defaultResolution" | "defaultTransition">>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  hasValidLLMConfig: () => boolean;
  hasValidSpeechConfig: () => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // LLM Settings
      llmProvider: "anthropic",
      anthropicApiKey: "",
      claudeModel: "claude-sonnet-4-5-20250514",
      openaiApiKey: "",
      openaiModel: "gpt-4.1",
      googleApiKey: "",
      googleModel: "gemini-2.5-flash",

      // Speech Analysis Settings
      speechProvider: "speechsuper",
      speechSuperApiKey: "",
      speechSuperAppId: "",
      elsaApiKey: "",

      // YouTube Settings
      youtubeConnected: false,
      youtubeChannelName: "",

      // UI Preferences
      theme: "system",
      autoSave: true,
      autoSaveInterval: 30,

      // Recording Preferences
      defaultRecordingMode: "per-slide",
      showWaveform: true,
      teleprompterSpeed: 150,
      teleprompterFontSize: 24,

      // Video Export Preferences
      defaultResolution: "1920x1080",
      defaultTransition: "fade",

      // Actions
      setLLMProvider: (provider) => set({ llmProvider: provider }),

      setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),

      setClaudeModel: (model) => set({ claudeModel: model }),

      setOpenAIApiKey: (key) => set({ openaiApiKey: key }),

      setOpenAIModel: (model) => set({ openaiModel: model }),

      setGoogleApiKey: (key) => set({ googleApiKey: key }),

      setGoogleModel: (model) => set({ googleModel: model }),

      setSpeechProvider: (provider) => set({ speechProvider: provider }),

      setSpeechSuperCredentials: (apiKey, appId) => set({
        speechSuperApiKey: apiKey,
        speechSuperAppId: appId
      }),

      setElsaApiKey: (key) => set({ elsaApiKey: key }),

      setYouTubeConnection: (connected, channelName) => set({
        youtubeConnected: connected,
        youtubeChannelName: channelName || "",
      }),

      setTheme: (theme) => set({ theme }),

      setAutoSave: (enabled, interval) => set({
        autoSave: enabled,
        ...(interval !== undefined && { autoSaveInterval: interval }),
      }),

      setRecordingPreferences: (prefs) => set(prefs),

      setVideoPreferences: (prefs) => set(prefs),

      loadSettings: async () => {
        try {
          const response = await fetch("/api/settings");
          if (response.ok) {
            const settings = await response.json();
            set(settings);
          }
        } catch (error) {
          console.error("Failed to load settings:", error);
        }
      },

      saveSettings: async () => {
        try {
          const state = get();
          await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              llmProvider: state.llmProvider,
              anthropicApiKey: state.anthropicApiKey,
              claudeModel: state.claudeModel,
              openaiApiKey: state.openaiApiKey,
              openaiModel: state.openaiModel,
              googleApiKey: state.googleApiKey,
              googleModel: state.googleModel,
              speechProvider: state.speechProvider,
              speechSuperApiKey: state.speechSuperApiKey,
              speechSuperAppId: state.speechSuperAppId,
              elsaApiKey: state.elsaApiKey,
              theme: state.theme,
              autoSave: state.autoSave,
              autoSaveInterval: state.autoSaveInterval,
              defaultRecordingMode: state.defaultRecordingMode,
              showWaveform: state.showWaveform,
              teleprompterSpeed: state.teleprompterSpeed,
              teleprompterFontSize: state.teleprompterFontSize,
              defaultResolution: state.defaultResolution,
              defaultTransition: state.defaultTransition,
            }),
          });
        } catch (error) {
          console.error("Failed to save settings:", error);
        }
      },

      hasValidLLMConfig: () => {
        const state = get();
        if (state.llmProvider === "anthropic") {
          return (state.anthropicApiKey?.length ?? 0) > 0;
        }
        if (state.llmProvider === "openai") {
          return (state.openaiApiKey?.length ?? 0) > 0;
        }
        if (state.llmProvider === "google") {
          return (state.googleApiKey?.length ?? 0) > 0;
        }
        // Claude CLI doesn't need API key
        return true;
      },

      hasValidSpeechConfig: () => {
        const state = get();
        if (state.speechProvider === "speechsuper") {
          return (state.speechSuperApiKey?.length ?? 0) > 0 && (state.speechSuperAppId?.length ?? 0) > 0;
        }
        return (state.elsaApiKey?.length ?? 0) > 0;
      },
    }),
    {
      name: "luminate-settings",
      partialize: (state) => ({
        llmProvider: state.llmProvider,
        anthropicApiKey: state.anthropicApiKey,
        claudeModel: state.claudeModel,
        openaiApiKey: state.openaiApiKey,
        openaiModel: state.openaiModel,
        googleApiKey: state.googleApiKey,
        googleModel: state.googleModel,
        speechProvider: state.speechProvider,
        speechSuperApiKey: state.speechSuperApiKey,
        speechSuperAppId: state.speechSuperAppId,
        elsaApiKey: state.elsaApiKey,
        theme: state.theme,
        autoSave: state.autoSave,
        autoSaveInterval: state.autoSaveInterval,
        defaultRecordingMode: state.defaultRecordingMode,
        showWaveform: state.showWaveform,
        teleprompterSpeed: state.teleprompterSpeed,
        teleprompterFontSize: state.teleprompterFontSize,
        defaultResolution: state.defaultResolution,
        defaultTransition: state.defaultTransition,
      }),
    }
  )
);
