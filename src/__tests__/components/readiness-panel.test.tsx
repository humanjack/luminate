import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadinessPanel } from "@/components/workflow/readiness-panel";
import type { ReadinessReport, SlideReadiness } from "@/lib/readiness";

function slide(status: SlideReadiness["status"]): SlideReadiness {
  return { slideIndex: 0, status, issues: [], scriptDuration: null, audioDuration: null };
}

function report(overrides: Partial<ReadinessReport> = {}): ReadinessReport {
  return {
    status: "ok",
    slides: [slide("ok"), slide("ok")],
    project: [],
    totals: { slides: 2, withAudio: 2, withScript: 2, errors: 0, warnings: 0 },
    canExport: true,
    ...overrides,
  };
}

describe("ReadinessPanel meter (#74)", () => {
  it("shows the completion meter as ready-over-total", () => {
    render(<ReadinessPanel projectId="p1" report={report()} />);
    expect(screen.getByTestId("radial-score")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(screen.getByText("slides ready")).toBeInTheDocument();
    expect(screen.getByTestId("readiness-status")).toHaveTextContent("Ready to export");
  });

  it("counts only non-error slides as ready", () => {
    const r = report({
      status: "error",
      slides: [slide("ok"), slide("error"), slide("warning"), slide("ok")],
      totals: { slides: 4, withAudio: 2, withScript: 3, errors: 1, warnings: 1 },
      canExport: false,
    });
    render(<ReadinessPanel projectId="p1" report={r} />);
    // 3 of 4 slides have no blocking error
    expect(screen.getByText("3/4")).toBeInTheDocument();
    expect(screen.getByTestId("readiness-status")).toHaveTextContent("Export blocked");
  });

  it("renders the dimension checklist chips", () => {
    const r = report({
      totals: { slides: 4, withAudio: 1, withScript: 4, errors: 0, warnings: 0 },
      slides: [slide("ok"), slide("ok"), slide("ok"), slide("ok")],
    });
    render(<ReadinessPanel projectId="p1" report={r} />);
    expect(screen.getByTestId("readiness-chip-slides")).toHaveTextContent("Slides 4/4");
    expect(screen.getByTestId("readiness-chip-script")).toHaveTextContent("Script 4/4");
    expect(screen.getByTestId("readiness-chip-audio")).toHaveTextContent("Audio 1/4");
  });

  it("handles zero slides without dividing by zero", () => {
    const r = report({
      status: "error",
      slides: [],
      totals: { slides: 0, withAudio: 0, withScript: 0, errors: 1, warnings: 0 },
      canExport: false,
    });
    render(<ReadinessPanel projectId="p1" report={r} />);
    expect(screen.getByText("0/0")).toBeInTheDocument();
  });
});
