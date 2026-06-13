import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { StepContainer } from "@/components/workflow/step-container";
import { Button } from "@/components/ui/button";

describe("motion polish (#75)", () => {
  it("applies a fade-in entrance to step content", () => {
    const { container } = render(
      <StepContainer title="Step">
        <p>body</p>
      </StepContainer>
    );
    const faded = container.querySelector(".fade-in");
    expect(faded).not.toBeNull();
    expect(faded).toHaveTextContent("body");
  });

  it("gives buttons a press micro-interaction", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button")).toHaveClass("active:scale-[0.97]");
  });

  it("defines the motion utilities and a reduced-motion guard in globals.css", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain(".fade-in");
    expect(css).toContain(".slide-up");
    expect(css).toContain(".lift");
    // global reduced-motion reset present
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0\.001ms/);
  });
});
