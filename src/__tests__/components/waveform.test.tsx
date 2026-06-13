import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Waveform,
  normalizeBars,
  placeholderBars,
} from "@/components/workflow/waveform";

describe("normalizeBars", () => {
  it("downsamples into the requested number of bars", () => {
    expect(normalizeBars([0, 0, 255, 255], 2)).toEqual([0, 1]);
  });
  it("normalizes against the max sample", () => {
    expect(normalizeBars([1, 2], 2)).toEqual([0.5, 1]);
  });
  it("returns zeros for empty input and [] for count<=0", () => {
    expect(normalizeBars([], 3)).toEqual([0, 0, 0]);
    expect(normalizeBars([1, 2, 3], 0)).toEqual([]);
  });
});

describe("placeholderBars", () => {
  it("is deterministic for a given seed", () => {
    expect(placeholderBars(5)).toEqual(placeholderBars(5));
  });
  it("has the requested length and stays within [0.18, 1]", () => {
    const bars = placeholderBars(3, 20);
    expect(bars).toHaveLength(20);
    expect(bars.every((b) => b >= 0.18 - 1e-9 && b <= 1 + 1e-9)).toBe(true);
  });
});

describe("Waveform", () => {
  it("renders one element per bar", () => {
    const { container } = render(<Waveform bars={[0.2, 0.5, 0.8]} />);
    expect(screen.getByTestId("waveform")).toBeInTheDocument();
    // bars are the direct span children
    expect(container.querySelectorAll("[data-testid='waveform'] > span")).toHaveLength(3);
  });

  it("exposes a slider role + aria-valuenow when seekable", () => {
    render(<Waveform bars={[0.2, 0.5]} progress={0.5} onSeek={() => {}} />);
    const el = screen.getByTestId("waveform");
    expect(el).toHaveAttribute("role", "slider");
    expect(el).toHaveAttribute("aria-valuenow", "50");
  });

  it("is not a slider when not seekable", () => {
    render(<Waveform bars={[0.2, 0.5]} live />);
    expect(screen.getByTestId("waveform")).not.toHaveAttribute("role");
  });
});
