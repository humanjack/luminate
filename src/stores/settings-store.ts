import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SearchProviderId } from "@/lib/research/search/types";
import { SECRET_KEYS, SECRET_SENTINEL } from "@/lib/api/secrets";

export type LLMProvider = "anthropic" | "openai" | "google" | "claude-cli";
export type SpeechProvider = "speechsuper" | "elsa" | "azure" | "openai";
export type { SearchProviderId };

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
  azureSpeechKey: string;
  azureSpeechRegion: string;

  // Research Settings (grounded web research — umbrella #43)
  enableWebResearch: boolean;
  searchProvider: SearchProviderId;
  maxSources: number;
  maxSearchIterations: number;
  tavilyApiKey: string;
  braveApiKey: string;

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

  // Which secrets the server reports as configured (derived from GET; not
  // persisted). Lets the UI show "saved" without the raw key ever being sent
  // to the browser.
  secretConfigured: Record<string, boolean>;

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
  setAzureSpeechCredentials: (key: string, region: string) => void;
  setResearchPreferences: (prefs: Partial<Pick<SettingsState, "enableWebResearch" | "searchProvider" | "maxSources" | "maxSearchIterations" | "tavilyApiKey" | "braveApiKey">>) => void;
  setYouTubeConnection: (connected: boolean, channelName?: string) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setAutoSave: (enabled: boolean, interval?: number) => void;
  setRecordingPreferences: (prefs: Partial<Pick<SettingsState, "defaultRecordingMode" | "showWaveform" | "teleprompterSpeed" | "teleprompterFontSize">>) => void;
  setVideoPreferences: (prefs: Partial<Pick<SettingsState, "defaultResolution" | "defaultTransition">>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  hasValidLLMConfig: () => boolean;
  hasValidServerLLMConfig: () => boolean;
  hasValidSpeechConfig: () => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // LLM Settings
      llmProvider: "openai",
      anthropicApiKey: "",
      claudeModel: "claude-sonnet-4-6",
      openaiApiKey: "",
      openaiModel: "gpt-5.5",
      googleApiKey: "",
      googleModel: "gemini-3-pro-preview",

      // Speech Analysis Settings
      speechProvider: "speechsuper",
      speechSuperApiKey: "",
      speechSuperAppId: "",
      elsaApiKey: "",
      azureSpeechKey: "",
      azureSpeechRegion: "eastus",

      // Research Settings — off by default; Phase 1 (#45) flips on grounded search.
      enableWebResearch: false,
      searchProvider: "anthropic",
      maxSources: 8,
      maxSearchIterations: 2,
      tavilyApiKey: "",
      braveApiKey: "",

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

      secretConfigured: {},

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

      setAzureSpeechCredentials: (key, region) => set({
        azureSpeechKey: key,
        azureSpeechRegion: region,
      }),

      setResearchPreferences: (prefs) => set(prefs),

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
            // Drop null/undefined so server values never clobber the store's typed
            // (string) defaults. Empty-string settings round-trip through the DB as
            // null (`JSON.parse("" || "null")`), which would otherwise make the
            // controlled inputs null-valued and trip React's "value should not be
            // null" warning.
            const clean = Object.fromEntries(
              Object.entries(settings).filter(([, value]) => value !== null && value !== undefined)
            );

            // Secrets are redacted by the server: the GET response carries a
            // sentinel plus a `<key>Configured` flag, never the raw key. Capture
            // the configured flags, and NEVER let the sentinel overwrite a real
            // key already in state (rehydrated from localStorage) — that key is
            // still needed client-side to call the LLM endpoints.
            const secretConfigured: Record<string, boolean> = { ...get().secretConfigured };
            for (const key of SECRET_KEYS) {
              const flag = clean[`${key}Configured`];
              if (typeof flag === "boolean") secretConfigured[key] = flag;
              delete clean[`${key}Configured`];
              if (clean[key] === SECRET_SENTINEL) delete clean[key];
            }

            set({ ...clean, secretConfigured });
          }
        } catch (error) {
          console.error("Failed to load settings:", error);
        }
      },

      saveSettings: async () => {
        try {
          const state = get();
          // For a secret the user left blank but the server already has, send
          // the sentinel so the stored key is left untouched (never wiped).
          const secretOut = (key: string, value: string) =>
            value === "" && state.secretConfigured[key] ? SECRET_SENTINEL : value;
          const response = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              llmProvider: state.llmProvider,
              anthropicApiKey: secretOut("anthropicApiKey", state.anthropicApiKey),
              claudeModel: state.claudeModel,
              openaiApiKey: secretOut("openaiApiKey", state.openaiApiKey),
              openaiModel: state.openaiModel,
              googleApiKey: secretOut("googleApiKey", state.googleApiKey),
              googleModel: state.googleModel,
              speechProvider: state.speechProvider,
              speechSuperApiKey: secretOut("speechSuperApiKey", state.speechSuperApiKey),
              speechSuperAppId: secretOut("speechSuperAppId", state.speechSuperAppId),
              elsaApiKey: secretOut("elsaApiKey", state.elsaApiKey),
              azureSpeechKey: secretOut("azureSpeechKey", state.azureSpeechKey),
              azureSpeechRegion: state.azureSpeechRegion,
              enableWebResearch: state.enableWebResearch,
              searchProvider: state.searchProvider,
              maxSources: state.maxSources,
              maxSearchIterations: state.maxSearchIterations,
              tavilyApiKey: secretOut("tavilyApiKey", state.tavilyApiKey),
              braveApiKey: secretOut("braveApiKey", state.braveApiKey),
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
          if (!response.ok) throw new Error("Failed to save settings");
          // Only acknowledge credentials after the server accepted the save.
          // Blank fields with an existing configured flag were sent as the
          // sentinel, so preserve those flags without requiring a reload.
          const configured = { ...state.secretConfigured };
          for (const key of SECRET_KEYS) {
            const value = state[key as keyof SettingsState];
            if (typeof value === "string" && value !== SECRET_SENTINEL && value.trim()) {
              configured[key] = true;
            }
          }
          set({ secretConfigured: configured });
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

      // Research/content/script resolve secrets on the server. Raw-key
      // callers (agent, SEO, clips) must keep using hasValidLLMConfig instead.
      hasValidServerLLMConfig: () => {
        const state = get();
        if (state.llmProvider === "claude-cli") return false;
        const key = `${state.llmProvider}ApiKey` as "anthropicApiKey" | "openaiApiKey" | "googleApiKey";
        return !!state.secretConfigured[key] || !!state[key]?.trim();
      },

      hasValidSpeechConfig: () => {
        const state = get();
        if (state.speechProvider === "speechsuper") {
          return (state.speechSuperApiKey?.length ?? 0) > 0 && (state.speechSuperAppId?.length ?? 0) > 0;
        }
        if (state.speechProvider === "elsa") {
          return (state.elsaApiKey?.length ?? 0) > 0;
        }
        if (state.speechProvider === "azure") {
          return (state.azureSpeechKey?.length ?? 0) > 0 && (state.azureSpeechRegion?.length ?? 0) > 0;
        }
        if (state.speechProvider === "openai") {
          return (state.openaiApiKey?.length ?? 0) > 0;
        }
        return false;
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
        azureSpeechKey: state.azureSpeechKey,
        azureSpeechRegion: state.azureSpeechRegion,
        enableWebResearch: state.enableWebResearch,
        searchProvider: state.searchProvider,
        maxSources: state.maxSources,
        maxSearchIterations: state.maxSearchIterations,
        tavilyApiKey: state.tavilyApiKey,
        braveApiKey: state.braveApiKey,
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
