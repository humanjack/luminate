import { describe, it, expect, beforeEach } from "vitest";
import { useWorkflowStore, WORKFLOW_STEPS, WorkflowStepId } from "@/stores/workflow-store";

describe("WORKFLOW_STEPS", () => {
  it("should have exactly 7 steps", () => {
    expect(WORKFLOW_STEPS).toHaveLength(7);
  });

  it("should have sequential IDs from 1 to 7", () => {
    WORKFLOW_STEPS.forEach((step, index) => {
      expect(step.id).toBe(index + 1);
    });
  });

  it("should have all required properties for each step", () => {
    WORKFLOW_STEPS.forEach((step) => {
      expect(step).toHaveProperty("id");
      expect(step).toHaveProperty("name");
      expect(step).toHaveProperty("path");
      expect(step).toHaveProperty("icon");
      expect(step).toHaveProperty("description");
    });
  });

  it("should have unique paths", () => {
    const paths = WORKFLOW_STEPS.map((s) => s.path);
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(paths.length);
  });

  it("should have correct step order", () => {
    expect(WORKFLOW_STEPS[0].name).toBe("Research");
    expect(WORKFLOW_STEPS[1].name).toBe("Content");
    expect(WORKFLOW_STEPS[2].name).toBe("Slides");
    expect(WORKFLOW_STEPS[3].name).toBe("Script");
    expect(WORKFLOW_STEPS[4].name).toBe("Recording");
    expect(WORKFLOW_STEPS[5].name).toBe("Analysis");
    expect(WORKFLOW_STEPS[6].name).toBe("Video");
  });
});

describe("useWorkflowStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useWorkflowStore.getState().resetWorkflow();
  });

  describe("initial state", () => {
    it("should start at step 1", () => {
      const { currentStep } = useWorkflowStore.getState();
      expect(currentStep).toBe(1);
    });

    it("should have maxCompletedStep of 0", () => {
      const { maxCompletedStep } = useWorkflowStore.getState();
      expect(maxCompletedStep).toBe(0);
    });
  });

  describe("isStepLocked", () => {
    it("should not lock step 1 initially", () => {
      const { isStepLocked } = useWorkflowStore.getState();
      expect(isStepLocked(1)).toBe(false);
    });

    it("should lock step 2 initially (more than 1 ahead of maxCompletedStep=0)", () => {
      const { isStepLocked } = useWorkflowStore.getState();
      expect(isStepLocked(2)).toBe(true);
    });

    it("should lock all steps beyond step 1 initially", () => {
      const { isStepLocked } = useWorkflowStore.getState();
      expect(isStepLocked(3)).toBe(true);
      expect(isStepLocked(4)).toBe(true);
      expect(isStepLocked(5)).toBe(true);
      expect(isStepLocked(6)).toBe(true);
      expect(isStepLocked(7)).toBe(true);
    });

    it("should unlock step 2 after completing step 1", () => {
      const store = useWorkflowStore.getState();
      store.completeStep(1);
      expect(useWorkflowStore.getState().isStepLocked(2)).toBe(false);
    });

    it("should unlock steps progressively", () => {
      const store = useWorkflowStore.getState();

      store.completeStep(1);
      expect(useWorkflowStore.getState().isStepLocked(2)).toBe(false);
      expect(useWorkflowStore.getState().isStepLocked(3)).toBe(true);

      store.completeStep(2);
      expect(useWorkflowStore.getState().isStepLocked(3)).toBe(false);
      expect(useWorkflowStore.getState().isStepLocked(4)).toBe(true);
    });
  });

  describe("canNavigateTo", () => {
    it("should allow navigation to step 1 initially", () => {
      const { canNavigateTo } = useWorkflowStore.getState();
      expect(canNavigateTo(1)).toBe(true);
    });

    it("should not allow navigation to step 2 initially", () => {
      const { canNavigateTo } = useWorkflowStore.getState();
      expect(canNavigateTo(2)).toBe(false);
    });

    it("should allow navigation to completed steps", () => {
      const store = useWorkflowStore.getState();
      store.completeStep(1);
      store.completeStep(2);
      store.completeStep(3);

      const { canNavigateTo } = useWorkflowStore.getState();
      expect(canNavigateTo(1)).toBe(true);
      expect(canNavigateTo(2)).toBe(true);
      expect(canNavigateTo(3)).toBe(true);
      expect(canNavigateTo(4)).toBe(true); // Next available
      expect(canNavigateTo(5)).toBe(false); // Too far ahead
    });
  });

  describe("setCurrentStep", () => {
    it("should set current step if navigation is allowed", () => {
      const store = useWorkflowStore.getState();
      store.setCurrentStep(1);
      expect(useWorkflowStore.getState().currentStep).toBe(1);
    });

    it("should not set current step if navigation is not allowed", () => {
      const store = useWorkflowStore.getState();
      store.setCurrentStep(5); // Can't navigate to step 5 initially
      expect(useWorkflowStore.getState().currentStep).toBe(1); // Should remain at 1
    });

    it("should allow setting to completed steps", () => {
      const store = useWorkflowStore.getState();
      store.completeStep(1);
      store.completeStep(2);
      store.completeStep(3);

      store.setCurrentStep(2);
      expect(useWorkflowStore.getState().currentStep).toBe(2);

      store.setCurrentStep(1);
      expect(useWorkflowStore.getState().currentStep).toBe(1);
    });
  });

  describe("completeStep", () => {
    it("should update maxCompletedStep", () => {
      const store = useWorkflowStore.getState();
      store.completeStep(1);
      expect(useWorkflowStore.getState().maxCompletedStep).toBe(1);
    });

    it("should not decrease maxCompletedStep", () => {
      const store = useWorkflowStore.getState();
      store.completeStep(3);
      store.completeStep(1);
      expect(useWorkflowStore.getState().maxCompletedStep).toBe(3);
    });

    it("should allow completing steps out of order", () => {
      const store = useWorkflowStore.getState();
      store.completeStep(5);
      expect(useWorkflowStore.getState().maxCompletedStep).toBe(5);
    });
  });

  describe("resetWorkflow", () => {
    it("should reset currentStep to 1", () => {
      const store = useWorkflowStore.getState();
      store.completeStep(3);
      store.setCurrentStep(3);
      store.resetWorkflow();
      expect(useWorkflowStore.getState().currentStep).toBe(1);
    });

    it("should reset maxCompletedStep to 0", () => {
      const store = useWorkflowStore.getState();
      store.completeStep(5);
      store.resetWorkflow();
      expect(useWorkflowStore.getState().maxCompletedStep).toBe(0);
    });
  });

  describe("getStepStatus", () => {
    it("should return 'current' for the current step", () => {
      const { getStepStatus } = useWorkflowStore.getState();
      expect(getStepStatus(1)).toBe("current");
    });

    it("should return 'locked' for steps too far ahead", () => {
      const { getStepStatus } = useWorkflowStore.getState();
      expect(getStepStatus(3)).toBe("locked");
      expect(getStepStatus(7)).toBe("locked");
    });

    it("should return 'completed' for completed steps", () => {
      const store = useWorkflowStore.getState();
      store.completeStep(1);
      store.completeStep(2);
      store.setCurrentStep(3);

      const { getStepStatus } = useWorkflowStore.getState();
      expect(getStepStatus(1)).toBe("completed");
      expect(getStepStatus(2)).toBe("completed");
    });

    it("should return 'upcoming' for the next available step", () => {
      const store = useWorkflowStore.getState();
      store.completeStep(1);
      store.setCurrentStep(1);

      const { getStepStatus } = useWorkflowStore.getState();
      expect(getStepStatus(2)).toBe("upcoming");
    });

    it("should handle edge case: current step is also the upcoming step", () => {
      // When currentStep = 1 and maxCompletedStep = 0
      // Step 1 should be 'current', not 'upcoming'
      const { getStepStatus } = useWorkflowStore.getState();
      expect(getStepStatus(1)).toBe("current");
    });

    it("should return correct status for all steps in a mid-workflow scenario", () => {
      const store = useWorkflowStore.getState();
      store.completeStep(1);
      store.completeStep(2);
      store.completeStep(3);
      store.setCurrentStep(4);

      const { getStepStatus } = useWorkflowStore.getState();
      expect(getStepStatus(1)).toBe("completed");
      expect(getStepStatus(2)).toBe("completed");
      expect(getStepStatus(3)).toBe("completed");
      expect(getStepStatus(4)).toBe("current");
      expect(getStepStatus(5)).toBe("locked");
      expect(getStepStatus(6)).toBe("locked");
      expect(getStepStatus(7)).toBe("locked");
    });
  });

  describe("workflow progression scenarios", () => {
    it("should support full workflow completion", () => {
      const store = useWorkflowStore.getState();

      // Complete all steps
      for (let i = 1; i <= 7; i++) {
        store.completeStep(i as WorkflowStepId);
      }

      const { maxCompletedStep, getStepStatus } = useWorkflowStore.getState();
      expect(maxCompletedStep).toBe(7);

      // All steps should be completed
      for (let i = 1; i <= 7; i++) {
        expect(getStepStatus(i as WorkflowStepId)).toBe("completed");
      }
    });

    it("should allow going back to previous steps", () => {
      const store = useWorkflowStore.getState();

      store.completeStep(1);
      store.completeStep(2);
      store.completeStep(3);

      // Go back to step 1
      store.setCurrentStep(1);
      expect(useWorkflowStore.getState().currentStep).toBe(1);

      // maxCompletedStep should remain unchanged
      expect(useWorkflowStore.getState().maxCompletedStep).toBe(3);
    });
  });
});
