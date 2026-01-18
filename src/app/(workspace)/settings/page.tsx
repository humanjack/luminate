"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Key, Mic, Video, Palette, Save, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore } from "@/stores/settings-store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type VerificationStatus = "idle" | "verifying" | "valid" | "invalid";

interface VerificationResult {
  status: VerificationStatus;
  message?: string;
  warning?: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const {
    llmProvider,
    anthropicApiKey,
    claudeModel,
    openaiApiKey,
    openaiModel,
    googleApiKey,
    googleModel,
    speechProvider,
    speechSuperApiKey,
    speechSuperAppId,
    elsaApiKey,
    theme,
    autoSave,
    autoSaveInterval,
    defaultRecordingMode,
    showWaveform,
    teleprompterSpeed,
    teleprompterFontSize,
    defaultResolution,
    defaultTransition,
    setLLMProvider,
    setAnthropicApiKey,
    setClaudeModel,
    setOpenAIApiKey,
    setOpenAIModel,
    setGoogleApiKey,
    setGoogleModel,
    setSpeechProvider,
    setSpeechSuperCredentials,
    setElsaApiKey,
    setTheme,
    setAutoSave,
    setRecordingPreferences,
    setVideoPreferences,
    saveSettings,
    loadSettings,
  } = useSettingsStore();

  // Verification states
  const [anthropicVerification, setAnthropicVerification] = useState<VerificationResult>({ status: "idle" });
  const [openaiVerification, setOpenaiVerification] = useState<VerificationResult>({ status: "idle" });
  const [googleVerification, setGoogleVerification] = useState<VerificationResult>({ status: "idle" });
  const [claudeCliVerification, setClaudeCliVerification] = useState<VerificationResult>({ status: "idle" });
  const [speechSuperVerification, setSpeechSuperVerification] = useState<VerificationResult>({ status: "idle" });
  const [elsaVerification, setElsaVerification] = useState<VerificationResult>({ status: "idle" });

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    await saveSettings();
    toast({
      title: "Settings saved",
      description: "Your settings have been saved successfully.",
    });
  };

  // Verification handlers
  const verifyAnthropicKey = async () => {
    if (!anthropicApiKey) {
      setAnthropicVerification({ status: "invalid", message: "Please enter an API key first" });
      return;
    }

    setAnthropicVerification({ status: "verifying" });

    try {
      const response = await fetch("/api/settings/verify/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: anthropicApiKey }),
      });

      const result = await response.json();

      if (result.valid) {
        setAnthropicVerification({
          status: "valid",
          message: result.message || "API key is valid",
        });
        toast({ title: "Verified", description: "Anthropic API key is valid!" });
      } else {
        setAnthropicVerification({
          status: "invalid",
          message: result.error || "Invalid API key",
        });
      }
    } catch (error) {
      setAnthropicVerification({
        status: "invalid",
        message: "Failed to verify API key",
      });
    }
  };

  const verifyOpenAI = async () => {
    if (!openaiApiKey) {
      setOpenaiVerification({ status: "invalid", message: "Please enter an API key first" });
      return;
    }

    setOpenaiVerification({ status: "verifying" });

    try {
      const response = await fetch("/api/settings/verify/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: openaiApiKey }),
      });

      const result = await response.json();

      if (result.valid) {
        setOpenaiVerification({
          status: "valid",
          message: result.message || "API key is valid",
        });
        toast({ title: "Verified", description: "OpenAI API key is valid!" });
      } else {
        setOpenaiVerification({
          status: "invalid",
          message: result.error || "Invalid API key",
        });
      }
    } catch (error) {
      setOpenaiVerification({
        status: "invalid",
        message: "Failed to verify API key",
      });
    }
  };

  const verifyGoogle = async () => {
    if (!googleApiKey) {
      setGoogleVerification({ status: "invalid", message: "Please enter an API key first" });
      return;
    }

    setGoogleVerification({ status: "verifying" });

    try {
      const response = await fetch("/api/settings/verify/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: googleApiKey }),
      });

      const result = await response.json();

      if (result.valid) {
        setGoogleVerification({
          status: "valid",
          message: result.message || "API key is valid",
        });
        toast({ title: "Verified", description: "Google API key is valid!" });
      } else {
        setGoogleVerification({
          status: "invalid",
          message: result.error || "Invalid API key",
        });
      }
    } catch (error) {
      setGoogleVerification({
        status: "invalid",
        message: "Failed to verify API key",
      });
    }
  };

  const verifyClaudeCli = async () => {
    setClaudeCliVerification({ status: "verifying" });

    try {
      const response = await fetch("/api/settings/verify/claude-cli", {
        method: "POST",
      });

      const result = await response.json();

      if (result.valid) {
        setClaudeCliVerification({
          status: "valid",
          message: result.version ? `Claude CLI ${result.version}` : "Claude CLI is available",
        });
        toast({ title: "Verified", description: "Claude CLI is working!" });
      } else {
        setClaudeCliVerification({
          status: "invalid",
          message: result.error || "Claude CLI not found",
        });
      }
    } catch (error) {
      setClaudeCliVerification({
        status: "invalid",
        message: "Failed to verify Claude CLI",
      });
    }
  };

  const verifySpeechSuper = async () => {
    if (!speechSuperApiKey || !speechSuperAppId) {
      setSpeechSuperVerification({ status: "invalid", message: "Please enter both API Key and App ID" });
      return;
    }

    setSpeechSuperVerification({ status: "verifying" });

    try {
      const response = await fetch("/api/settings/verify/speechsuper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: speechSuperApiKey, appId: speechSuperAppId }),
      });

      const result = await response.json();

      if (result.valid) {
        setSpeechSuperVerification({
          status: "valid",
          message: result.message,
          warning: result.warning,
        });
        toast({ title: "Verified", description: result.message });
      } else {
        setSpeechSuperVerification({
          status: "invalid",
          message: result.error,
        });
      }
    } catch (error) {
      setSpeechSuperVerification({
        status: "invalid",
        message: "Failed to verify credentials",
      });
    }
  };

  const verifyElsa = async () => {
    if (!elsaApiKey) {
      setElsaVerification({ status: "invalid", message: "Please enter an API key first" });
      return;
    }

    setElsaVerification({ status: "verifying" });

    try {
      const response = await fetch("/api/settings/verify/elsa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: elsaApiKey }),
      });

      const result = await response.json();

      if (result.valid) {
        setElsaVerification({
          status: "valid",
          message: result.message,
          warning: result.warning,
        });
        toast({ title: "Verified", description: result.message });
      } else {
        setElsaVerification({
          status: "invalid",
          message: result.error,
        });
      }
    } catch (error) {
      setElsaVerification({
        status: "invalid",
        message: "Failed to verify API key",
      });
    }
  };

  // Verification status component
  const VerificationBadge = ({ result }: { result: VerificationResult }) => {
    if (result.status === "idle") return null;

    return (
      <div className={cn(
        "flex items-center gap-2 mt-2 p-2 rounded-md text-sm",
        result.status === "verifying" && "bg-muted text-muted-foreground",
        result.status === "valid" && "bg-green-500/10 text-green-600 dark:text-green-400",
        result.status === "invalid" && "bg-red-500/10 text-red-600 dark:text-red-400"
      )}>
        {result.status === "verifying" && <Loader2 className="h-4 w-4 animate-spin" />}
        {result.status === "valid" && <CheckCircle className="h-4 w-4" />}
        {result.status === "invalid" && <XCircle className="h-4 w-4" />}
        <span>{result.status === "verifying" ? "Verifying..." : result.message}</span>
        {result.warning && (
          <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            <AlertCircle className="h-3 w-3" />
            {result.warning}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>

        <Tabs defaultValue="api" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="api">
              <Key className="w-4 h-4 mr-2" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="recording">
              <Mic className="w-4 h-4 mr-2" />
              Recording
            </TabsTrigger>
            <TabsTrigger value="video">
              <Video className="w-4 h-4 mr-2" />
              Video
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="w-4 h-4 mr-2" />
              Appearance
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="api" className="space-y-6">
            {/* LLM Provider */}
            <Card>
              <CardHeader>
                <CardTitle>LLM Provider</CardTitle>
                <CardDescription>
                  Configure your AI provider for research and content generation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={llmProvider}
                    onValueChange={(v) => {
                      setLLMProvider(v as any);
                      // Reset verification when provider changes
                      setAnthropicVerification({ status: "idle" });
                      setOpenaiVerification({ status: "idle" });
                      setGoogleVerification({ status: "idle" });
                      setClaudeCliVerification({ status: "idle" });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">Anthropic API</SelectItem>
                      <SelectItem value="openai">OpenAI API</SelectItem>
                      <SelectItem value="google">Google API</SelectItem>
                      <SelectItem value="claude-cli">Claude Code CLI</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {llmProvider === "anthropic" && "Use the Anthropic API directly with your API key."}
                    {llmProvider === "openai" && "Use the OpenAI API with your API key."}
                    {llmProvider === "google" && "Use the Google Gemini API with your API key."}
                    {llmProvider === "claude-cli" && "Use the Claude Code CLI (must be installed and configured)."}
                  </p>
                </div>

                {llmProvider === "anthropic" ? (
                  <>
                    <div className="space-y-2">
                      <Label>Anthropic API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="sk-ant-..."
                          value={anthropicApiKey}
                          onChange={(e) => {
                            setAnthropicApiKey(e.target.value);
                            setAnthropicVerification({ status: "idle" });
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={verifyAnthropicKey}
                          disabled={anthropicVerification.status === "verifying"}
                        >
                          {anthropicVerification.status === "verifying" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Get your API key from{" "}
                        <a
                          href="https://console.anthropic.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          console.anthropic.com
                        </a>
                      </p>
                      <VerificationBadge result={anthropicVerification} />
                    </div>

                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Select value={claudeModel} onValueChange={setClaudeModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="claude-opus-4-5-20251101">Claude Opus 4.5</SelectItem>
                          <SelectItem value="claude-sonnet-4-5-20250514">Claude Sonnet 4.5</SelectItem>
                          <SelectItem value="claude-haiku-4-5-20251101">Claude Haiku 4.5</SelectItem>
                          <SelectItem value="claude-3-7-sonnet-20250224">Claude 3.7 Sonnet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : llmProvider === "openai" ? (
                  <>
                    <div className="space-y-2">
                      <Label>OpenAI API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="sk-..."
                          value={openaiApiKey}
                          onChange={(e) => {
                            setOpenAIApiKey(e.target.value);
                            setOpenaiVerification({ status: "idle" });
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={verifyOpenAI}
                          disabled={openaiVerification.status === "verifying"}
                        >
                          {openaiVerification.status === "verifying" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Get your API key from{" "}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          platform.openai.com
                        </a>
                      </p>
                      <VerificationBadge result={openaiVerification} />
                    </div>

                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Select value={openaiModel} onValueChange={setOpenAIModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-5.2">GPT-5.2</SelectItem>
                          <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                          <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                          <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                          <SelectItem value="o3">O3</SelectItem>
                          <SelectItem value="o4-mini">O4 Mini</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o (Legacy)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : llmProvider === "google" ? (
                  <>
                    <div className="space-y-2">
                      <Label>Google API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="AIza..."
                          value={googleApiKey}
                          onChange={(e) => {
                            setGoogleApiKey(e.target.value);
                            setGoogleVerification({ status: "idle" });
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={verifyGoogle}
                          disabled={googleVerification.status === "verifying"}
                        >
                          {googleVerification.status === "verifying" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Get your API key from{" "}
                        <a
                          href="https://aistudio.google.com/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          aistudio.google.com
                        </a>
                      </p>
                      <VerificationBadge result={googleVerification} />
                    </div>

                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Select value={googleModel} onValueChange={setGoogleModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini-3-pro-preview">Gemini 3 Pro</SelectItem>
                          <SelectItem value="gemini-3-flash-preview">Gemini 3 Flash</SelectItem>
                          <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                          <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                          <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                          <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash (Legacy)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>Claude Code CLI</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 px-3 py-2 border rounded-md bg-muted text-muted-foreground text-sm">
                        Using local Claude Code CLI
                      </div>
                      <Button
                        variant="outline"
                        onClick={verifyClaudeCli}
                        disabled={claudeCliVerification.status === "verifying"}
                      >
                        {claudeCliVerification.status === "verifying" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Check"
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Claude Code CLI must be installed. Run{" "}
                      <code className="bg-muted px-1 rounded">npm install -g @anthropic-ai/claude-code</code>
                    </p>
                    <VerificationBadge result={claudeCliVerification} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Speech Analysis Provider */}
            <Card>
              <CardHeader>
                <CardTitle>Speech Analysis Provider</CardTitle>
                <CardDescription>
                  Configure your speech analysis API for pronunciation feedback.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={speechProvider}
                    onValueChange={(v) => {
                      setSpeechProvider(v as any);
                      setSpeechSuperVerification({ status: "idle" });
                      setElsaVerification({ status: "idle" });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="speechsuper">SpeechSuper</SelectItem>
                      <SelectItem value="elsa">ELSA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {speechProvider === "speechsuper" ? (
                  <>
                    <div className="space-y-2">
                      <Label>SpeechSuper API Key</Label>
                      <Input
                        type="password"
                        placeholder="Your API key"
                        value={speechSuperApiKey}
                        onChange={(e) => {
                          setSpeechSuperCredentials(e.target.value, speechSuperAppId);
                          setSpeechSuperVerification({ status: "idle" });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SpeechSuper App ID</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Your App ID"
                          value={speechSuperAppId}
                          onChange={(e) => {
                            setSpeechSuperCredentials(speechSuperApiKey, e.target.value);
                            setSpeechSuperVerification({ status: "idle" });
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={verifySpeechSuper}
                          disabled={speechSuperVerification.status === "verifying"}
                        >
                          {speechSuperVerification.status === "verifying" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      </div>
                      <VerificationBadge result={speechSuperVerification} />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>ELSA API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="Your ELSA API key"
                        value={elsaApiKey}
                        onChange={(e) => {
                          setElsaApiKey(e.target.value);
                          setElsaVerification({ status: "idle" });
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={verifyElsa}
                        disabled={elsaVerification.status === "verifying"}
                      >
                        {elsaVerification.status === "verifying" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Verify"
                        )}
                      </Button>
                    </div>
                    <VerificationBadge result={elsaVerification} />
                  </div>
                )}

                <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Speech analysis is optional. Mock data will be used if not configured.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recording Tab */}
          <TabsContent value="recording" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recording Preferences</CardTitle>
                <CardDescription>
                  Configure your recording and teleprompter settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Default Recording Mode</Label>
                  <Select
                    value={defaultRecordingMode}
                    onValueChange={(v) =>
                      setRecordingPreferences({ defaultRecordingMode: v as any })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per-slide">Per Slide</SelectItem>
                      <SelectItem value="continuous">Continuous</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Per slide: Record each slide separately. Continuous: Record the entire presentation at once.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Waveform</Label>
                    <p className="text-xs text-muted-foreground">
                      Display audio waveform visualization during recording.
                    </p>
                  </div>
                  <Switch
                    checked={showWaveform}
                    onCheckedChange={(checked) =>
                      setRecordingPreferences({ showWaveform: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Teleprompter Speed (WPM)</Label>
                  <Input
                    type="number"
                    value={teleprompterSpeed}
                    onChange={(e) =>
                      setRecordingPreferences({
                        teleprompterSpeed: parseInt(e.target.value) || 150,
                      })
                    }
                    min={50}
                    max={300}
                  />
                  <p className="text-xs text-muted-foreground">
                    Words per minute for teleprompter scrolling speed.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Teleprompter Font Size</Label>
                  <Input
                    type="number"
                    value={teleprompterFontSize}
                    onChange={(e) =>
                      setRecordingPreferences({
                        teleprompterFontSize: parseInt(e.target.value) || 24,
                      })
                    }
                    min={16}
                    max={48}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Video Tab */}
          <TabsContent value="video" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Video Export Settings</CardTitle>
                <CardDescription>
                  Configure default settings for video export.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Resolution</Label>
                  <Select
                    value={defaultResolution}
                    onValueChange={(v) =>
                      setVideoPreferences({ defaultResolution: v as any })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1280x720">720p (1280x720)</SelectItem>
                      <SelectItem value="1920x1080">1080p (1920x1080)</SelectItem>
                      <SelectItem value="2560x1440">1440p (2560x1440)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default Transition</Label>
                  <Select
                    value={defaultTransition}
                    onValueChange={(v) =>
                      setVideoPreferences({ defaultTransition: v as any })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="fade">Fade</SelectItem>
                      <SelectItem value="slide">Slide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize the look and feel of the application.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select value={theme} onValueChange={(v) => setTheme(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-save</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically save your work periodically.
                    </p>
                  </div>
                  <Switch
                    checked={autoSave}
                    onCheckedChange={(checked) => setAutoSave(checked)}
                  />
                </div>

                {autoSave && (
                  <div className="space-y-2">
                    <Label>Auto-save Interval (seconds)</Label>
                    <Input
                      type="number"
                      value={autoSaveInterval}
                      onChange={(e) =>
                        setAutoSave(true, parseInt(e.target.value) || 30)
                      }
                      min={10}
                      max={300}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
