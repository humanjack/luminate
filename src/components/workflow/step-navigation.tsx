"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WORKFLOW_STEPS, useWorkflowStore, type WorkflowStepId } from "@/stores/workflow-store";
import { useProjectStore } from "@/stores/project-store";
import { debug } from "@/lib/debug";

interface StepNavigationProps {
  projectId: string;
  currentStep: WorkflowStepId;
  onNext?: () => Promise<boolean> | boolean;
  onPrevious?: () => void;
  nextLabel?: string;
  previousLabel?: string;
  isNextDisabled?: boolean;
  isNextLoading?: boolean;
}

export function StepNavigation({
  projectId,
  currentStep,
  onNext,
  onPrevious,
  nextLabel,
  previousLabel,
  isNextDisabled = false,
  isNextLoading = false,
}: StepNavigationProps) {
  const router = useRouter();
  const { completeStep, setCurrentStep } = useWorkflowStore();
  const { updateProject } = useProjectStore();

  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);
  const previousStep = currentStepIndex > 0 ? WORKFLOW_STEPS[currentStepIndex - 1] : null;
  const nextStep = currentStepIndex < WORKFLOW_STEPS.length - 1 ? WORKFLOW_STEPS[currentStepIndex + 1] : null;

  // Debug: log navigation state
  debug.log("navigation", `StepNavigation render: step=${currentStep}, index=${currentStepIndex}, nextStep=${nextStep?.name || 'none'}, isNextDisabled=${isNextDisabled}, isNextLoading=${isNextLoading}`);

  const handlePrevious = () => {
    debug.nav("handlePrevious", previousStep?.path);
    if (onPrevious) {
      onPrevious();
    }
    if (previousStep) {
      debug.step(currentStep, previousStep.id, "navigating to previous step");
      setCurrentStep(previousStep.id as WorkflowStepId);
      router.push(`/projects/${projectId}/${previousStep.path}`);
    }
  };

  const handleNext = async () => {
    debug.nav("handleNext", nextStep?.path);
    if (onNext) {
      debug.log("navigation", "calling onNext callback (save data)...");
      try {
        const canProceed = await onNext();
        if (!canProceed) {
          debug.warn("navigation", "onNext returned false, blocking navigation");
          return;
        }
        debug.log("navigation", "onNext completed successfully");
      } catch (error) {
        debug.error("navigation", `onNext threw error: ${(error as Error).message}`);
        return;
      }
    }

    debug.log("navigation", `marking step ${currentStep} as complete`);
    completeStep(currentStep);

    if (nextStep) {
      debug.step(currentStep, nextStep.id, "navigating to next step");

      // Update project's currentStep in the database
      debug.log("navigation", `updating project currentStep to ${nextStep.id}`);
      await updateProject(projectId, { currentStep: nextStep.id });

      setCurrentStep(nextStep.id as WorkflowStepId);
      router.push(`/projects/${projectId}/${nextStep.path}`);
    }
  };

  return (
    <div className="flex items-center justify-between py-4 px-6 border-t bg-card">
      <Button
        variant="outline"
        onClick={handlePrevious}
        disabled={!previousStep}
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        {previousLabel || previousStep?.name || "Previous"}
      </Button>

      <div className="text-sm text-muted-foreground">
        Step {currentStep} of {WORKFLOW_STEPS.length}
      </div>

      <Button
        onClick={handleNext}
        disabled={isNextDisabled || isNextLoading || !nextStep}
      >
        {isNextLoading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            Processing...
          </span>
        ) : (
          <>
            {nextLabel || nextStep?.name || "Next"}
            <ChevronRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
