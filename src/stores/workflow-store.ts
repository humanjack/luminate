import { create } from "zustand";
import { debug } from "@/lib/debug";

export const WORKFLOW_STEPS = [
  { id: 1, name: "Research", path: "research", icon: "🔍", description: "Research your topic" },
  { id: 2, name: "Content", path: "content", icon: "📝", description: "Generate presentation content" },
  { id: 3, name: "Slides", path: "slides", icon: "🎨", description: "Create slide deck" },
  { id: 4, name: "Script", path: "script", icon: "📜", description: "Write video script" },
  { id: 5, name: "Recording", path: "recording", icon: "🎙️", description: "Record audio" },
  { id: 6, name: "Analysis", path: "analysis", icon: "📊", description: "Analyze pronunciation" },
  { id: 7, name: "Video", path: "video", icon: "🎬", description: "Export final video" },
] as const;

export type WorkflowStepId = (typeof WORKFLOW_STEPS)[number]["id"];

interface WorkflowState {
  currentStep: WorkflowStepId;
  maxCompletedStep: WorkflowStepId;
  isStepLocked: (step: WorkflowStepId) => boolean;
  canNavigateTo: (step: WorkflowStepId) => boolean;
  setCurrentStep: (step: WorkflowStepId) => void;
  setMaxCompletedStep: (step: WorkflowStepId) => void;
  completeStep: (step: WorkflowStepId) => void;
  resetWorkflow: () => void;
  getStepStatus: (step: WorkflowStepId) => "completed" | "current" | "upcoming" | "locked";
}

export const useWorkflowStore = create<WorkflowState>()((set, get) => ({
  currentStep: 1,
  maxCompletedStep: 0 as WorkflowStepId,

  isStepLocked: (step: WorkflowStepId) => {
    const { maxCompletedStep } = get();
    // Step is locked if it's more than 1 step ahead of maxCompletedStep
    const isLocked = step > maxCompletedStep + 1;
    debug.log("workflow", `isStepLocked(${step}): ${isLocked} (maxCompleted: ${maxCompletedStep})`);
    return isLocked;
  },

  canNavigateTo: (step: WorkflowStepId) => {
    const { maxCompletedStep } = get();
    // Can navigate to any completed step or the next available step
    const canNav = step <= maxCompletedStep + 1;
    debug.log("workflow", `canNavigateTo(${step}): ${canNav} (maxCompleted: ${maxCompletedStep})`);
    return canNav;
  },

  setCurrentStep: (step: WorkflowStepId) => {
    const { currentStep: prevStep } = get();
    if (get().canNavigateTo(step)) {
      debug.step(prevStep, step, "setCurrentStep");
      set({ currentStep: step });
    } else {
      debug.warn("workflow", `setCurrentStep(${step}) blocked - cannot navigate from step ${prevStep}`);
    }
  },

  setMaxCompletedStep: (step: WorkflowStepId) => {
    const { maxCompletedStep: prev } = get();
    debug.log("workflow", `setMaxCompletedStep: ${prev} -> ${step}`);
    set({ maxCompletedStep: step });
  },

  completeStep: (step: WorkflowStepId) => {
    const { maxCompletedStep } = get();
    if (step > maxCompletedStep) {
      debug.log("workflow", `completeStep(${step}): marking as completed (was: ${maxCompletedStep})`);
      set({ maxCompletedStep: step });
    } else {
      debug.log("workflow", `completeStep(${step}): already completed (maxCompleted: ${maxCompletedStep})`);
    }
  },

  resetWorkflow: () => {
    debug.log("workflow", "resetWorkflow: resetting to step 1");
    set({ currentStep: 1, maxCompletedStep: 0 as WorkflowStepId });
  },

  getStepStatus: (step: WorkflowStepId) => {
    const { currentStep, maxCompletedStep } = get();
    if (step <= maxCompletedStep) return "completed";
    if (step === currentStep) return "current";
    if (step === maxCompletedStep + 1) return "upcoming";
    return "locked";
  },
}));
