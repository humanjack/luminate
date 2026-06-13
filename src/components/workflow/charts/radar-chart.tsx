"use client";

import { cn } from "@/lib/utils";

export interface RadarDatum {
  label: string;
  /** 0–100 */
  value: number;
}

/** Point on a circle; angle 0 = straight up, increasing clockwise. */
export function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
}

/** Vertices for a set of values (0–100) mapped onto a radar of maxRadius. */
export function radarPolygon(
  values: number[],
  cx: number,
  cy: number,
  maxRadius: number
): [number, number][] {
  const n = values.length;
  if (n === 0) return [];
  return values.map((v, i) => {
    const clamped = Math.max(0, Math.min(100, v)) / 100;
    return polarPoint(cx, cy, maxRadius * clamped, (360 / n) * i);
  });
}

const toPath = (pts: [number, number][]) =>
  pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

interface RadarChartProps {
  data: RadarDatum[];
  size?: number;
  className?: string;
}

/**
 * Lightweight SVG radar chart for the 4 sub-scores. Pure presentational,
 * no chart dependency. Concentric rings at 25/50/75/100.
 */
export function RadarChart({ data, size = 240, className }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 34; // leave room for labels
  const n = data.length;
  const rings = [25, 50, 75, 100];

  const dataPts = radarPolygon(
    data.map((d) => d.value),
    cx,
    cy,
    maxRadius
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("w-full h-auto", className)}
      role="img"
      aria-label={data.map((d) => `${d.label} ${Math.round(d.value)}`).join(", ")}
      data-testid="radar-chart"
    >
      {/* grid rings */}
      {rings.map((pct) => (
        <polygon
          key={pct}
          points={toPath(
            radarPolygon(
              data.map(() => pct),
              cx,
              cy,
              maxRadius
            )
          )}
          fill="none"
          className="stroke-border"
          strokeWidth={1}
        />
      ))}

      {/* spokes */}
      {data.map((_, i) => {
        const [x, y] = polarPoint(cx, cy, maxRadius, (360 / n) * i);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            className="stroke-border"
            strokeWidth={1}
          />
        );
      })}

      {/* data polygon */}
      <polygon
        points={toPath(dataPts)}
        className="fill-primary/25 stroke-primary"
        strokeWidth={2}
        style={{ transition: "all 300ms ease-out" }}
      />
      {dataPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} className="fill-primary" />
      ))}

      {/* axis labels */}
      {data.map((d, i) => {
        const [x, y] = polarPoint(cx, cy, maxRadius + 18, (360 / n) * i);
        return (
          <text
            key={d.label}
            x={x}
            y={y}
            fontSize={11}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
