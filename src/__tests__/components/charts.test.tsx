import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { RadialScore, dashOffset } from "@/components/workflow/charts/radial-score";
import {
  RadarChart,
  polarPoint,
  radarPolygon,
} from "@/components/workflow/charts/radar-chart";
import {
  WpmMeter,
  wpmBand,
  wpmPositionPct,
} from "@/components/workflow/charts/wpm-meter";
import {
  scoreTone,
  scoreLabel,
} from "@/components/workflow/charts/score-color";

describe("score-color", () => {
  it("bands scores into good/ok/bad", () => {
    expect(scoreTone(95)).toBe("good");
    expect(scoreTone(90)).toBe("good");
    expect(scoreTone(80)).toBe("ok");
    expect(scoreTone(75)).toBe("ok");
    expect(scoreTone(74)).toBe("bad");
    expect(scoreTone(0)).toBe("bad");
  });

  it("labels overall scores", () => {
    expect(scoreLabel(92)).toBe("Excellent");
    expect(scoreLabel(85)).toBe("Good");
    expect(scoreLabel(72)).toBe("Fair");
    expect(scoreLabel(40)).toBe("Needs Work");
  });
});

describe("RadialScore geometry", () => {
  const C = 100;
  it("maps value → stroke-dashoffset (0 = empty ring, 100 = full)", () => {
    expect(dashOffset(0, C)).toBe(C);
    expect(dashOffset(100, C)).toBe(0);
    expect(dashOffset(50, C)).toBe(C / 2);
  });
  it("clamps out-of-range values", () => {
    expect(dashOffset(-20, C)).toBe(C);
    expect(dashOffset(140, C)).toBe(0);
  });
  it("renders", () => {
    render(<RadialScore value={88} caption="Overall Score" />);
    expect(screen.getByTestId("radial-score")).toBeInTheDocument();
    expect(screen.getByText("Overall Score")).toBeInTheDocument();
  });
});

describe("RadarChart geometry", () => {
  it("places angle 0 at the top of the circle", () => {
    const [x, y] = polarPoint(100, 100, 50, 0);
    expect(x).toBeCloseTo(100, 5);
    expect(y).toBeCloseTo(50, 5);
  });
  it("maps value 0 to center and 100 to the outer radius", () => {
    const pts = radarPolygon([0, 100], 100, 100, 50);
    expect(pts).toHaveLength(2);
    // index 0, value 0 → at center
    expect(pts[0][0]).toBeCloseTo(100, 5);
    expect(pts[0][1]).toBeCloseTo(100, 5);
    // index 1, value 100 → outer radius (180° = bottom for n=2)
    const dist = Math.hypot(pts[1][0] - 100, pts[1][1] - 100);
    expect(dist).toBeCloseTo(50, 5);
  });
  it("renders all axis labels", () => {
    render(
      <RadarChart
        data={[
          { label: "Pronunciation", value: 80 },
          { label: "Fluency", value: 70 },
          { label: "Confidence", value: 60 },
          { label: "Naturalness", value: 90 },
        ]}
      />
    );
    expect(screen.getByTestId("radar-chart")).toBeInTheDocument();
    expect(screen.getByText("Pronunciation")).toBeInTheDocument();
    expect(screen.getByText("Naturalness")).toBeInTheDocument();
  });
});

describe("WpmMeter", () => {
  it("classifies the speaking-rate band", () => {
    expect(wpmBand(90)).toBe("slow");
    expect(wpmBand(120)).toBe("ideal");
    expect(wpmBand(135)).toBe("ideal");
    expect(wpmBand(150)).toBe("ideal");
    expect(wpmBand(180)).toBe("fast");
  });
  it("positions a value along the scale, clamped", () => {
    expect(wpmPositionPct(60, 60, 210)).toBe(0);
    expect(wpmPositionPct(210, 60, 210)).toBe(100);
    expect(wpmPositionPct(135, 60, 210)).toBeCloseTo(50, 5);
    expect(wpmPositionPct(10, 60, 210)).toBe(0);
    expect(wpmPositionPct(400, 60, 210)).toBe(100);
  });
  it("renders the rate and a marker", () => {
    render(<WpmMeter wpm={138} />);
    expect(screen.getByTestId("wpm-meter")).toBeInTheDocument();
    expect(screen.getByText("138 WPM")).toBeInTheDocument();
    expect(screen.getByTestId("wpm-marker")).toBeInTheDocument();
  });
});
