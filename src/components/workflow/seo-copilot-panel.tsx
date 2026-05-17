"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ClipboardCopy,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsStore } from "@/stores/settings-store";
import type { VideoMetadata } from "@/lib/db/schema";

interface SeoCopilotPanelProps {
  projectId: string;
  onMetadataChange?: (metadata: VideoMetadata) => void;
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 75
      ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800"
      : score >= 55
      ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800"
      : "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-mono ${tone}`}
    >
      CTR {score}
    </span>
  );
}

function copy(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(text);
  }
}

export function SeoCopilotPanel({ projectId, onMetadataChange }: SeoCopilotPanelProps) {
  const { llmProvider, anthropicApiKey, claudeModel, hasValidLLMConfig } = useSettingsStore();

  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState("");

  const isAnthropic = llmProvider === "anthropic";
  const canGenerate = isAnthropic && hasValidLLMConfig();

  // Hydrate on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/projects/${projectId}/video-metadata`)
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setMetadata(data ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (metadata) onMetadataChange?.(metadata);
  }, [metadata, onMetadataChange]);

  const generate = useCallback(async () => {
    if (!canGenerate) {
      setError(
        isAnthropic
          ? "Please configure your Anthropic API key in Settings."
          : "The SEO copilot currently runs against Anthropic only — switch your provider in Settings."
      );
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/llm/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          apiKey: anthropicApiKey,
          model: claudeModel,
          targetAudience: audience.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Generation failed (${res.status})`);
      }
      setMetadata(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [canGenerate, isAnthropic, projectId, anthropicApiKey, claudeModel, audience]);

  const updateMetadata = useCallback(
    async (patch: Partial<Pick<VideoMetadata, "selectedTitleIndex" | "description" | "tags">>) => {
      const res = await fetch(`/api/projects/${projectId}/video-metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setMetadata(updated);
      }
    },
    [projectId]
  );

  const titles = metadata?.titles ?? [];
  const tags = metadata?.tags ?? [];
  const description = metadata?.description ?? "";
  const selectedTitle = useMemo(
    () => titles[metadata?.selectedTitleIndex ?? 0]?.text ?? "",
    [titles, metadata?.selectedTitleIndex]
  );

  return (
    <Card data-testid="seo-copilot-panel" className="border-indigo-200 dark:border-indigo-900">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="w-4 h-4 text-indigo-500" />
              YouTube SEO Copilot
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generates titles, description, and tags from your research and scripts.
            </p>
          </div>
          <Button
            onClick={generate}
            disabled={generating || !canGenerate}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : metadata ? (
              <RefreshCw className="w-4 h-4 mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {metadata ? "Regenerate" : "Generate SEO"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-end gap-2">
          <div>
            <Label htmlFor="seo-audience" className="text-xs">
              Target audience (optional)
            </Label>
            <Input
              id="seo-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. solo developers, climate-conscious renters"
              className="h-8"
              disabled={generating}
            />
          </div>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 flex items-start gap-2">
            <X className="w-3.5 h-3.5 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading && !metadata && (
          <p className="text-xs text-muted-foreground">Loading saved SEO…</p>
        )}

        {!loading && !metadata && !generating && (
          <p className="text-xs text-muted-foreground italic">
            Click <strong>Generate SEO</strong> to produce title candidates, a description, and tags from this project's research and scripts.
          </p>
        )}

        {titles.length > 0 && (
          <div data-testid="seo-titles" className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Title candidates</h3>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Pick one — it carries through to YouTube upload
              </span>
            </div>
            <ul className="space-y-2">
              {titles.map((t, i) => {
                const selected = i === metadata?.selectedTitleIndex;
                return (
                  <li
                    key={`${t.text}-${i}`}
                    className={`rounded-lg border p-3 transition cursor-pointer hover:border-indigo-400 ${
                      selected
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                        : "border-border bg-card"
                    }`}
                    onClick={() => updateMetadata({ selectedTitleIndex: i })}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {selected && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                          <span>{t.text}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{t.reasoning}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ScoreBadge score={t.ctrScore} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label="Copy title"
                          onClick={(e) => {
                            e.stopPropagation();
                            copy(t.text);
                          }}
                        >
                          <ClipboardCopy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t.text.length} chars
                    </div>
                  </li>
                );
              })}
            </ul>
            {selectedTitle && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedTitle}</span>
              </p>
            )}
          </div>
        )}

        {description && (
          <div data-testid="seo-description">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Description</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(description)}
                className="h-7 text-xs"
              >
                <ClipboardCopy className="w-3.5 h-3.5 mr-1" />
                Copy
              </Button>
            </div>
            <Textarea
              value={description}
              onChange={(e) =>
                setMetadata((m) => (m ? { ...m, description: e.target.value } : m))
              }
              onBlur={(e) => updateMetadata({ description: e.target.value })}
              rows={9}
              className="font-mono text-xs leading-relaxed"
            />
          </div>
        )}

        {tags.length > 0 && (
          <div data-testid="seo-tags">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tags</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(tags.join(", "))}
                className="h-7 text-xs"
              >
                <ClipboardCopy className="w-3.5 h-3.5 mr-1" />
                Copy all
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
