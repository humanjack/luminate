"use client";

import { cn } from "@/lib/utils";
import { useCountUp } from "./use-count-up";
import { scoreTone, scoreLabel, TONE_STROKE, TONE_TEXT } from "./score-color";

/** Stroke-dashoffset for a value (0–100) on a ring of the given circumference. */
export function dashOffset(value: number, circumference: number): number {
  const clamped = Math.max(0, Math.min(100, value));
  return circumference * (1 - clamped / 100);
}

interface RadialScoreProps {
  /** 0–100 */
  value: number;
  /** Diameter in px. */
  size?: number;
  /** Ring thickness in px. */
  stroke?: number;
  /** Small caption under the ring (e.g. "Overall Score"). */
  caption?: string;
  /** Show the qualitative label (Excellent/Good/…) inside the ring. */
  showLabel?: boolean;
  /** Override the displayed denominator label, e.g. "8 / 10". */
  display?: string;
  className?: string;
}

/**
 * Animated circular score gauge. Color-graded red/amber/green and
 * reduced-motion safe (the number snaps; the arc transition is a short,
 * harmless CSS tween).
 */
export function RadialScore({
  value,
  size = 160,
  stroke = 12,
  caption = "Overall Score",
  showLabel = true,
  display,
  className,
}: RadialScoreProps) {
  const animated = useCountUp(value);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const tone = scoreTone(value);

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      data-testid="radial-score"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`Score ${Math.round(value)} out of 100`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={TONE_STROKE[tone]}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset(animated, circumference)}
            style={{ transition: "stroke-dashoffset 120ms linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn("text-4xl font-bold tabular-nums leading-none", TONE_TEXT[tone])}
          >
            {display ?? Math.round(animated)}
          </span>
          {showLabel && (
            <span className="text-xs font-medium mt-1 text-muted-foreground">
              {scoreLabel(value)}
            </span>
          )}
        </div>
      </div>
      {caption && <p className="text-sm text-muted-foreground mt-2">{caption}</p>}
    </div>
  );
}
