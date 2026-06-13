import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ProjectCardPreview,
  gradientFromName,
} from "@/components/workflow/project-card-preview";

describe("gradientFromName", () => {
  it("is deterministic for a given name", () => {
    expect(gradientFromName("My Project")).toEqual(gradientFromName("My Project"));
  });
  it("returns two valid hsl colors", () => {
    const g = gradientFromName("Anything");
    expect(g.from).toMatch(/^hsl\(\d+ 70% 55%\)$/);
    expect(g.to).toMatch(/^hsl\(\d+ 70% 42%\)$/);
  });
  it("differs for different names (usually)", () => {
    expect(gradientFromName("Alpha").from).not.toBe(gradientFromName("Zulu").from);
  });
});

describe("ProjectCardPreview fallback chain", () => {
  it("prefers the selected thumbnail", () => {
    render(
      <ProjectCardPreview
        name="P"
        thumbnailSvg="<svg/>"
        slideMarkdown="# Slide"
      />
    );
    expect(screen.getByTestId("card-preview-thumbnail")).toBeInTheDocument();
    expect(screen.queryByTestId("card-preview-slide")).not.toBeInTheDocument();
  });

  it("falls back to the first slide when there's no thumbnail", () => {
    render(<ProjectCardPreview name="P" slideMarkdown="# Slide" />);
    expect(screen.getByTestId("card-preview-slide")).toBeInTheDocument();
    expect(screen.queryByTestId("card-preview-gradient")).not.toBeInTheDocument();
  });

  it("falls back to a name-derived gradient with the initial", () => {
    render(<ProjectCardPreview name="Quantum" />);
    const el = screen.getByTestId("card-preview-gradient");
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("Q");
  });
});
