"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Image as ImageIcon, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Thumbnail } from "@/lib/db/schema";
import type { ThumbnailPreset } from "@/lib/thumbnails/types";

const PRESET_LABELS: Record<ThumbnailPreset, string> = {
  "bold-text": "Bold Text",
  question: "Question",
  "numbered-list": "Numbered Hook",
  reaction: "Reaction",
};

function svgToDataUrl(svg: string): string {
  if (typeof window === "undefined") return "";
  return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
}

interface ThumbnailPickerProps {
  projectId: string;
}

export function ThumbnailPicker({ projectId }: ThumbnailPickerProps) {
  const [variants, setVariants] = useState<Thumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/thumbnails`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setVariants(data);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/thumbnails`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Failed to generate (${res.status})`);
      const data = await res.json();
      setVariants(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [projectId]);

  const select = useCallback(
    async (preset: ThumbnailPreset) => {
      const res = await fetch(`/api/projects/${projectId}/thumbnails`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset }),
      });
      if (res.ok) setVariants(await res.json());
    },
    [projectId]
  );

  return (
    <Card
      data-testid="thumbnail-picker"
      className="border-fuchsia-200 dark:border-fuchsia-900"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="w-4 h-4 text-fuchsia-500" />
              AI Thumbnail Generator
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Four template variants computed from your title and first slide.
              No external image API required.
            </p>
          </div>
          <Button
            onClick={generate}
            disabled={generating}
            size="sm"
            className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : variants.length > 0 ? (
              <RefreshCw className="w-4 h-4 mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {variants.length > 0 ? "Regenerate" : "Generate thumbnails"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 mb-3">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-xs text-muted-foreground">Loading saved thumbnails…</p>
        )}

        {!loading && variants.length === 0 && !generating && (
          <p className="text-xs text-muted-foreground italic">
            Click <strong>Generate thumbnails</strong> to render four variants from this project's content.
          </p>
        )}

        {variants.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {variants.map((variant) => {
              const url = svgToDataUrl(variant.svg);
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => select(variant.preset)}
                  data-testid={`thumbnail-${variant.preset}`}
                  className={`group relative rounded-lg border overflow-hidden transition focus:outline-none focus:ring-2 focus:ring-fuchsia-400 ${
                    variant.selected
                      ? "border-fuchsia-500 ring-2 ring-fuchsia-500"
                      : "border-border hover:border-fuchsia-300"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${PRESET_LABELS[variant.preset]} thumbnail`}
                    className="w-full aspect-video object-cover bg-muted"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2 bg-black/55 text-white text-xs">
                    <span className="font-medium">{PRESET_LABELS[variant.preset]}</span>
                    {variant.selected && (
                      <span className="inline-flex items-center gap-1 text-fuchsia-200">
                        <Check className="w-3.5 h-3.5" />
                        Selected
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
