"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Flame, Loader2, RefreshCw, Scissors, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClipSuggestion } from "@/lib/db/schema";
import { useSettingsStore } from "@/stores/settings-store";

interface ClipExtractorProps {
  projectId: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function viralityColor(score: number): string {
  if (score >= 75)
    return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800";
  if (score >= 55)
    return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800";
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
}

export function ClipExtractor({ projectId }: ClipExtractorProps) {
  const { llmProvider, anthropicApiKey, claudeModel, hasValidLLMConfig } = useSettingsStore();
  const [clips, setClips] = useState<ClipSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAnthropic = llmProvider === "anthropic";
  const canGenerate = isAnthropic && hasValidLLMConfig();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/clips`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: ClipSuggestion[]) => !cancelled && setClips(d))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const suggest = useCallback(async () => {
    if (!canGenerate) {
      setError(
        isAnthropic
          ? "Configure your Anthropic API key in Settings."
          : "The clip extractor currently runs against Anthropic only."
      );
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/llm/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          apiKey: anthropicApiKey,
          model: claudeModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setClips(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [canGenerate, isAnthropic, projectId, anthropicApiKey, claudeModel]);

  const updateStatus = useCallback(
    async (clipId: string, status: "kept" | "discarded" | "suggested") => {
      const res = await fetch(`/api/projects/${projectId}/clips`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId, status }),
      });
      if (res.ok) setClips(await res.json());
    },
    [projectId]
  );

  return (
    <Card
      data-testid="clip-extractor"
      className="border-rose-200 dark:border-rose-900"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scissors className="w-4 h-4 text-rose-500" />
              Short-clip suggestions
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              The AI scans your script + slide timings and proposes 15–60 second moments
              ready to repurpose for Shorts/TikTok.
            </p>
          </div>
          <Button
            onClick={suggest}
            disabled={generating || !canGenerate}
            size="sm"
            className="bg-rose-600 hover:bg-rose-500 text-white"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : clips.length > 0 ? (
              <RefreshCw className="w-4 h-4 mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {clips.length > 0 ? "Regenerate" : "Suggest clips"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 flex items-start gap-2">
            <X className="w-3.5 h-3.5 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {loading && !clips.length && (
          <p className="text-xs text-muted-foreground">Loading suggestions…</p>
        )}
        {!loading && clips.length === 0 && !generating && (
          <p className="text-xs text-muted-foreground italic">
            Click <strong>Suggest clips</strong> to scan this project's script for
            shareable moments.
          </p>
        )}
        {clips.length > 0 && (
          <ul className="space-y-2" data-testid="clip-list">
            {clips.map((clip) => {
              const dur = clip.endSec - clip.startSec;
              return (
                <li
                  key={clip.id}
                  className={`rounded-lg border p-3 transition ${
                    clip.status === "kept"
                      ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
                      : clip.status === "discarded"
                      ? "border-border bg-muted opacity-60"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${viralityColor(
                            clip.viralityScore
                          )}`}
                        >
                          <Flame className="w-3 h-3" />
                          {clip.viralityScore}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatTime(clip.startSec)}–{formatTime(clip.endSec)} ·{" "}
                          {Math.round(dur)}s
                        </span>
                      </div>
                      <p className="mt-1 font-semibold text-sm leading-snug">
                        {clip.hook}
                      </p>
                      {clip.reasoning && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {clip.reasoning}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant={clip.status === "kept" ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() =>
                          updateStatus(clip.id, clip.status === "kept" ? "suggested" : "kept")
                        }
                      >
                        <Check className="w-3 h-3 mr-1" />
                        {clip.status === "kept" ? "Kept" : "Keep"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => updateStatus(clip.id, "discarded")}
                      >
                        <X className="w-3 h-3 mr-1" />
                        Discard
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
