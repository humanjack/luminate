import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LLMProgressPanel } from "@/components/workflow/llm-progress-panel";

describe("LLMProgressPanel (#71)", () => {
  it("shows a shimmer skeleton while preparing, before any output", () => {
    render(<LLMProgressPanel status="preparing" prompt="hi" />);
    expect(screen.getByTestId("llm-skeleton")).toBeInTheDocument();
    // No live output box / caret yet
    expect(screen.queryByTestId("llm-caret")).not.toBeInTheDocument();
    expect(screen.queryByText(/Waiting for response/)).not.toBeInTheDocument();
  });

  it("renders a blinking caret while streaming and never pulses the whole output box", () => {
    render(<LLMProgressPanel status="streaming" output="Hello" />);
    const caret = screen.getByTestId("llm-caret");
    expect(caret).toBeInTheDocument();
    expect(caret).toHaveClass("llm-caret");

    const pre = caret.closest("pre");
    expect(pre).not.toBeNull();
    // The distracting whole-box pulse must be gone.
    expect(pre!.className).not.toContain("animate-pulse");

    // Char counter reflects streamed length.
    expect(screen.getByText("5 chars")).toBeInTheDocument();
  });

  it("drops the caret and skeleton once complete", () => {
    render(<LLMProgressPanel status="complete" output="Done output here" />);
    expect(screen.queryByTestId("llm-caret")).not.toBeInTheDocument();
    expect(screen.queryByTestId("llm-skeleton")).not.toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("renders nothing when idle with no prompt or output", () => {
    const { container } = render(<LLMProgressPanel status="idle" />);
    expect(container).toBeEmptyDOMElement();
  });
});
