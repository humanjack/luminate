import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StepNavigation } from "@/components/workflow/step-navigation";
import { useWorkflowStore } from "@/stores/workflow-store";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("StepNavigation", () => {
  beforeEach(() => {
    // Reset all mocks and store state
    vi.clearAllMocks();
    useWorkflowStore.getState().resetWorkflow();
  });

  describe("rendering", () => {
    it("should render previous and next buttons", () => {
      render(
        <StepNavigation
          projectId="test-project"
          currentStep={2}
        />
      );

      expect(screen.getByRole("button", { name: /research/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /slides/i })).toBeInTheDocument();
    });

    it("should display current step number", () => {
      render(
        <StepNavigation
          projectId="test-project"
          currentStep={3}
        />
      );

      expect(screen.getByText(/step 3 of 7/i)).toBeInTheDocument();
    });

    it("should disable previous button on first step", () => {
      render(
        <StepNavigation
          projectId="test-project"
          currentStep={1}
        />
      );

      const previousButton = screen.getAllByRole("button")[0];
      expect(previousButton).toBeDisabled();
    });

    it("should disable next button on last step", () => {
      render(
        <StepNavigation
          projectId="test-project"
          currentStep={7}
        />
      );

      const nextButton = screen.getAllByRole("button")[1];
      expect(nextButton).toBeDisabled();
    });

    it("should use custom labels when provided", () => {
      render(
        <StepNavigation
          projectId="test-project"
          currentStep={2}
          previousLabel="Go Back"
          nextLabel="Continue"
        />
      );

      expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("should navigate to previous step on previous button click", async () => {
      // Setup: complete step 1 so we can be at step 2
      useWorkflowStore.getState().completeStep(1);
      useWorkflowStore.getState().setCurrentStep(2);

      render(
        <StepNavigation
          projectId="test-project"
          currentStep={2}
        />
      );

      const previousButton = screen.getAllByRole("button")[0];
      fireEvent.click(previousButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/projects/test-project/research");
      });
    });

    it("should call onNext and navigate on next button click", async () => {
      const onNext = vi.fn().mockResolvedValue(true);

      render(
        <StepNavigation
          projectId="test-project"
          currentStep={1}
          onNext={onNext}
        />
      );

      const nextButton = screen.getByRole("button", { name: /content/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(onNext).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/projects/test-project/content");
      });
    });

    it("should not navigate if onNext returns false", async () => {
      const onNext = vi.fn().mockResolvedValue(false);

      render(
        <StepNavigation
          projectId="test-project"
          currentStep={1}
          onNext={onNext}
        />
      );

      const nextButton = screen.getByRole("button", { name: /content/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(onNext).toHaveBeenCalled();
      });

      // Navigation should NOT have been called
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should call onPrevious callback when navigating back", async () => {
      const onPrevious = vi.fn();

      // Setup: complete step 1 so we can be at step 2
      useWorkflowStore.getState().completeStep(1);
      useWorkflowStore.getState().setCurrentStep(2);

      render(
        <StepNavigation
          projectId="test-project"
          currentStep={2}
          onPrevious={onPrevious}
        />
      );

      const previousButton = screen.getAllByRole("button")[0];
      fireEvent.click(previousButton);

      expect(onPrevious).toHaveBeenCalled();
    });

    it("should complete current step when navigating to next", async () => {
      const onNext = vi.fn().mockResolvedValue(true);

      render(
        <StepNavigation
          projectId="test-project"
          currentStep={1}
          onNext={onNext}
        />
      );

      const nextButton = screen.getByRole("button", { name: /content/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(useWorkflowStore.getState().maxCompletedStep).toBe(1);
      });
    });
  });

  describe("disabled state", () => {
    it("should disable next button when isNextDisabled is true", () => {
      render(
        <StepNavigation
          projectId="test-project"
          currentStep={1}
          isNextDisabled={true}
        />
      );

      const nextButton = screen.getByRole("button", { name: /content/i });
      expect(nextButton).toBeDisabled();
    });

    it("should show loading state when isNextLoading is true", () => {
      render(
        <StepNavigation
          projectId="test-project"
          currentStep={1}
          isNextLoading={true}
        />
      );

      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });

    it("should disable next button when isNextLoading is true", () => {
      render(
        <StepNavigation
          projectId="test-project"
          currentStep={1}
          isNextLoading={true}
        />
      );

      const nextButton = screen.getByRole("button", { name: /processing/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe("workflow integration", () => {
    it("should correctly navigate through all steps", async () => {
      const store = useWorkflowStore.getState();

      // Start at step 1
      const { rerender } = render(
        <StepNavigation
          projectId="test-project"
          currentStep={1}
          onNext={async () => true}
        />
      );

      // Click next to go to step 2
      fireEvent.click(screen.getByRole("button", { name: /content/i }));

      await waitFor(() => {
        expect(store.maxCompletedStep).toBeGreaterThanOrEqual(1);
      });

      // Verify navigation was called
      expect(mockPush).toHaveBeenLastCalledWith("/projects/test-project/content");
    });
  });
});
