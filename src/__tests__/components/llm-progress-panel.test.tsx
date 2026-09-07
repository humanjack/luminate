import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
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

  it("auto-expands on active phase transitions while preserving a collapse between streamed chunks", () => {
    const { rerender } = render(<LLMProgressPanel status="complete" output="First output" />);
    fireEvent.click(screen.getByText("Complete"));
    expect(screen.queryByText("First output")).not.toBeInTheDocument();
    rerender(<LLMProgressPanel status="preparing" prompt="Next prompt" />);
    expect(screen.getByText("Next prompt")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Preparing request..."));
    rerender(<LLMProgressPanel status="streaming" output="Chunk one" />);
    expect(screen.getByText("Chunk one")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Receiving response..."));
    rerender(<LLMProgressPanel status="streaming" output="Chunk one and two" />);
    expect(screen.queryByText("Chunk one and two")).not.toBeInTheDocument();
    rerender(<LLMProgressPanel status="complete" output="Chunk one and two" />);
    expect(screen.queryByText("Chunk one and two")).not.toBeInTheDocument();
    rerender(<LLMProgressPanel status="streaming" output="New run" />);
    expect(screen.getByText("New run")).toBeInTheDocument();
  });

  describe("elapsed meter", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("restarts the clock for each run instead of carrying the idle gap (regression for #76 review)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(0);

      const { rerender } = render(
        <LLMProgressPanel status="streaming" output="x" />
      );
      // 5s of activity on the first run
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.getByTestId("llm-elapsed").textContent).toBe("5.0s");

      // First run completes — meter freezes at 5.0s
      rerender(<LLMProgressPanel status="complete" output="x" />);
      expect(screen.getByTestId("llm-elapsed").textContent).toBe("5.0s");

      // A long idle gap passes before the user kicks off another generation
      act(() => vi.advanceTimersByTime(30000));

      // Second run begins (preparing) — consumers never go back to "idle"
      rerender(<LLMProgressPanel status="preparing" />);
      act(() => vi.advanceTimersByTime(200));

      // Must reflect THIS run (~0.2s), not 35.2s since the first run started
      expect(screen.getByTestId("llm-elapsed").textContent).toBe("0.2s");
    });
  });
});
