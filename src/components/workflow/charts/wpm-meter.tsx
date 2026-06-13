"use client";

import { cn } from "@/lib/utils";

export type WpmBand = "slow" | "ideal" | "fast";

export function wpmBand(wpm: number, lo = 120, hi = 150): WpmBand {
  if (wpm < lo) return "slow";
  if (wpm > hi) return "fast";
  return "ideal";
}

/** Position (0–100%) of a wpm value along a [min,max] scale, clamped. */
export function wpmPositionPct(wpm: number, min = 60, max = 210): number {
  return Math.max(0, Math.min(100, ((wpm - min) / (max - min)) * 100));
}

const BAND_LABEL: Record<WpmBand, string> = {
  slow: "A touch slow",
  ideal: "In the ideal range",
  fast: "A touch fast",
};
const BAND_TEXT: Record<WpmBand, string> = {
  slow: "text-amber-500",
  ideal: "text-emerald-500",
  fast: "text-amber-500",
};

interface WpmMeterProps {
  wpm: number;
  lo?: number;
  hi?: number;
  min?: number;
  max?: number;
  className?: string;
}

/**
 * Horizontal speaking-rate dial with the ideal band highlighted and a
 * marker at the current rate.
 */
export function WpmMeter({
  wpm,
  lo = 120,
  hi = 150,
  min = 60,
  max = 210,
  className,
}: WpmMeterProps) {
  const band = wpmBand(wpm, lo, hi);
  const pos = wpmPositionPct(wpm, min, max);
  const bandLeft = wpmPositionPct(lo, min, max);
  const bandRight = wpmPositionPct(hi, min, max);

  return (
    <div className={cn("space-y-2", className)} data-testid="wpm-meter">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Speaking Rate</span>
        <span className="font-bold tabular-nums">{Math.round(wpm)} WPM</span>
      </div>
      <div className="relative h-3 rounded-full bg-muted overflow-hidden">
        {/* ideal band */}
        <div
          className="absolute inset-y-0 bg-emerald-500/30"
          style={{ left: `${bandLeft}%`, width: `${bandRight - bandLeft}%` }}
        />
      </div>
      {/* marker on its own track so it can overflow the bar cleanly */}
      <div className="relative h-0">
        <div
          className="absolute -top-[18px] -translate-x-1/2 flex flex-col items-center"
          style={{ left: `${pos}%` }}
          data-testid="wpm-marker"
        >
          <div className="w-0.5 h-4 bg-foreground" />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span className={cn("font-medium", BAND_TEXT[band])}>{BAND_LABEL[band]}</span>
        <span>{max}</span>
      </div>
      <p className="text-xs text-muted-foreground">Ideal range: {lo}–{hi} WPM</p>
    </div>
  );
}
