import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/projects/p1/slides",
}));

import { WorkflowStepper } from "@/components/workflow/workflow-stepper";
import { useWorkflowStore } from "@/stores/workflow-store";

describe("WorkflowStepper (#69)", () => {
  beforeEach(() => {
    useWorkflowStore.setState({ maxCompletedStep: 0, currentStep: 1 } as never);
    push.mockClear();
  });

  it("renders a global progress bar reflecting completed steps", () => {
    useWorkflowStore.setState({ maxCompletedStep: 3, currentStep: 3 } as never);
    render(<WorkflowStepper projectId="p1" />);
    const bar = screen.getByTestId("workflow-progress");
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "7");
    const fill = screen.getByTestId("workflow-progress-fill");
    // 3 of 7 ≈ 42.857%
    expect(fill.getAttribute("style")).toContain("width: 42.857");
  });

  it("shows 0% with no completed steps", () => {
    render(<WorkflowStepper projectId="p1" />);
    const fill = screen.getByTestId("workflow-progress-fill");
    expect(fill.getAttribute("style")).toContain("width: 0%");
    expect(screen.getByTestId("workflow-progress")).toHaveAttribute("aria-valuenow", "0");
  });

  it("marks the active step with aria-current", () => {
    useWorkflowStore.setState({ maxCompletedStep: 2, currentStep: 3 } as never);
    render(<WorkflowStepper projectId="p1" />);
    // pathname mock points at /slides (step 3)
    const active = screen.getByRole("button", { current: "step" });
    expect(active).toHaveTextContent("Slides");
  });
});
