"use client";

import { useMemo } from "react";
import { Mic, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeClarity, highlightFillers, type FillerEntry } from "@/lib/analysis/clarity";

interface PracticePanelProps {
  scriptText?: string | null;
  fillerWords?: FillerEntry[] | null;
  waveform?: number[] | null;
  durationSec?: number | null;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export function PracticePanel({
  scriptText,
  fillerWords,
  waveform,
  durationSec,
}: PracticePanelProps) {
  const breakdown = useMemo(
    () =>
      computeClarity({
        scriptText,
        fillerWords,
        waveform,
        durationSec,
      }),
    [scriptText, fillerWords, waveform, durationSec]
  );

  const highlighted = useMemo(
    () => highlightFillers(scriptText ?? "", fillerWords ?? []),
    [scriptText, fillerWords]
  );

  const hasContent = !!(scriptText && fillerWords && fillerWords.length >= 0);

  return (
    <Card data-testid="practice-panel" className="border-emerald-200 dark:border-emerald-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mic className="w-4 h-4 text-emerald-600" />
          Practice mode
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Filler words are highlighted in your script. The clarity score combines
          filler density with long-silence ratio (cuts &gt; 800ms).
        </p>
      </CardHeader>
      <CardContent>
        {!hasContent ? (
          <p className="text-xs text-muted-foreground italic">
            Record this slide and run analysis to see your clarity breakdown.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Metric
                label="Clarity"
                value={breakdown.score}
                unit=""
                className={scoreColor(breakdown.score)}
                hero
              />
              <Metric
                label="Fillers / 100w"
                value={breakdown.fillersPer100Words}
                unit=""
              />
              <Metric
                label="Total fillers"
                value={breakdown.totalFillers}
                unit=""
              />
              <Metric
                label="Long-silence ratio"
                value={Math.round(breakdown.longSilenceRatio * 100)}
                unit="%"
              />
            </div>
            <div
              data-testid="practice-script"
              className="rounded-md border bg-card p-4 text-sm leading-relaxed font-medium"
              dangerouslySetInnerHTML={{ __html: highlighted || "<em>No script for this slide.</em>" }}
            />
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                Tip: read the highlighted spots aloud once or twice before re-recording — most
                speakers cut their filler rate in half on the second try.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  unit,
  className,
  hero,
}: {
  label: string;
  value: number;
  unit: string;
  className?: string;
  hero?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${hero ? "bg-muted/50" : ""}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 tabular-nums font-semibold ${hero ? "text-3xl" : "text-xl"} ${
          className ?? ""
        }`}
      >
        {value}
        {unit}
      </div>
    </div>
  );
}
