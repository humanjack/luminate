"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Key, Mic, Video, Palette, Save } from "lucide-react";
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

export default function SettingsPage() {
  const { toast } = useToast();
  const {
    llmProvider,
    anthropicApiKey,
    claudeModel,
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
                    onValueChange={(v) => setLLMProvider(v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">Anthropic API</SelectItem>
                      <SelectItem value="claude-cli">Claude Code CLI</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {llmProvider === "anthropic"
                      ? "Use the Anthropic API directly with your API key."
                      : "Use the Claude Code CLI (must be installed and configured)."}
                  </p>
                </div>

                {llmProvider === "anthropic" && (
                  <>
                    <div className="space-y-2">
                      <Label>Anthropic API Key</Label>
                      <Input
                        type="password"
                        placeholder="sk-ant-..."
                        value={anthropicApiKey}
                        onChange={(e) => setAnthropicApiKey(e.target.value)}
                      />
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
                    </div>

                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Select value={claudeModel} onValueChange={setClaudeModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="claude-sonnet-4-5-20250514">Claude Sonnet 4.5</SelectItem>
                          <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                          <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
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
                    onValueChange={(v) => setSpeechProvider(v as any)}
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
                        onChange={(e) =>
                          setSpeechSuperCredentials(e.target.value, speechSuperAppId)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SpeechSuper App ID</Label>
                      <Input
                        placeholder="Your App ID"
                        value={speechSuperAppId}
                        onChange={(e) =>
                          setSpeechSuperCredentials(speechSuperApiKey, e.target.value)
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>ELSA API Key</Label>
                    <Input
                      type="password"
                      placeholder="Your ELSA API key"
                      value={elsaApiKey}
                      onChange={(e) => setElsaApiKey(e.target.value)}
                    />
                  </div>
                )}
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
