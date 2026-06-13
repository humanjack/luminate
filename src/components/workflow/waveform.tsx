"use client";

import { cn } from "@/lib/utils";

/** Downsample a raw sample array into `count` bars normalized to [0,1]. */
export function normalizeBars(samples: number[], count: number): number[] {
  if (count <= 0) return [];
  if (samples.length === 0) return new Array(count).fill(0);
  const max = Math.max(1, ...samples.map((s) => Math.abs(s)));
  const bucket = samples.length / count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucket));
    let sum = 0;
    let n = 0;
    for (let j = start; j < end && j < samples.length; j++) {
      sum += Math.abs(samples[j]);
      n++;
    }
    out.push(n ? sum / n / max : 0);
  }
  return out;
}

/**
 * Deterministic decorative waveform for a saved clip whose per-sample data
 * isn't available client-side. Stable for a given seed so it doesn't jitter
 * between renders.
 */
export function placeholderBars(seed: number, count = 48): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = Math.abs(
      Math.sin(i * 0.5 + seed) * 0.6 + Math.sin(i * 0.17 + seed * 1.3) * 0.4
    );
    out.push(0.18 + 0.82 * Math.min(1, v));
  }
  return out;
}

function liveColor(h: number): string {
  if (h > 0.8) return "bg-red-500";
  if (h > 0.5) return "bg-yellow-500";
  return "bg-emerald-500";
}

interface WaveformProps {
  /** Bar heights in [0,1]. */
  bars: number[];
  /** Playhead position in [0,1]; bars up to it render as "played". */
  progress?: number;
  /** Live input mode (color by level instead of played/unplayed). */
  live?: boolean;
  /** Click-to-seek callback receiving a [0,1] ratio. */
  onSeek?: (ratio: number) => void;
  className?: string;
}

export function Waveform({ bars, progress, live, onSeek, className }: WaveformProps) {
  const total = bars.length;
  const playedTo = progress != null ? Math.round(progress * total) : -1;

  return (
    <div
      data-testid="waveform"
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "Playback position" : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={
        onSeek && progress != null ? Math.round(progress * 100) : undefined
      }
      onClick={
        onSeek
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.min(
                1,
                Math.max(0, (e.clientX - rect.left) / rect.width)
              );
              onSeek(ratio);
            }
          : undefined
      }
      className={cn(
        "flex items-center gap-[2px] h-16 w-full",
        onSeek && "cursor-pointer",
        className
      )}
    >
      {bars.map((h, i) => {
        const played = progress != null && i <= playedTo;
        return (
          <span
            key={i}
            className={cn(
              "flex-1 min-w-[2px] rounded-sm self-center transition-[height] duration-75",
              live
                ? liveColor(h)
                : played
                ? "bg-primary"
                : "bg-muted-foreground/30"
            )}
            style={{ height: `${Math.max(6, Math.min(100, h * 100))}%` }}
          />
        );
      })}
    </div>
  );
}
