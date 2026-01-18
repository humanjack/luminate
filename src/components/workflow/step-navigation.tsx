"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WORKFLOW_STEPS, useWorkflowStore, type WorkflowStepId } from "@/stores/workflow-store";

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
  const { completeStep, setCurrentStep, canNavigateTo } = useWorkflowStore();

  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);
  const previousStep = currentStepIndex > 0 ? WORKFLOW_STEPS[currentStepIndex - 1] : null;
  const nextStep = currentStepIndex < WORKFLOW_STEPS.length - 1 ? WORKFLOW_STEPS[currentStepIndex + 1] : null;

  const handlePrevious = () => {
    if (onPrevious) {
      onPrevious();
    }
    if (previousStep) {
      setCurrentStep(previousStep.id as WorkflowStepId);
      router.push(`/projects/${projectId}/${previousStep.path}`);
    }
  };

  const handleNext = async () => {
    if (onNext) {
      const canProceed = await onNext();
      if (!canProceed) return;
    }

    completeStep(currentStep);

    if (nextStep) {
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
