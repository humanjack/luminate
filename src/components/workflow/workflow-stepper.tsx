"use client";

import { useRouter, usePathname } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_STEPS, useWorkflowStore, type WorkflowStepId } from "@/stores/workflow-store";

interface WorkflowStepperProps {
  projectId: string;
}

export function WorkflowStepper({ projectId }: WorkflowStepperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { canNavigateTo, getStepStatus, setCurrentStep, maxCompletedStep } =
    useWorkflowStore();

  const currentPath = pathname.split("/").pop();
  const totalSteps = WORKFLOW_STEPS.length;
  const progressPct = Math.min(100, (maxCompletedStep / totalSteps) * 100);

  const handleStepClick = (step: (typeof WORKFLOW_STEPS)[number]) => {
    if (canNavigateTo(step.id as WorkflowStepId)) {
      setCurrentStep(step.id as WorkflowStepId);
      router.push(`/projects/${projectId}/${step.path}`);
    }
  };

  return (
    <div className="border-b bg-card">
      <nav className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          {WORKFLOW_STEPS.map((step, index) => {
            const status = getStepStatus(step.id as WorkflowStepId);
            const isActive = currentPath === step.path;
            const isClickable = canNavigateTo(step.id as WorkflowStepId);
            const isCompleted = status === "completed";
            // A connector is "filled" once its left-hand step is completed.
            const connectorFilled = isCompleted;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => handleStepClick(step)}
                  disabled={!isClickable}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200",
                    isActive && "bg-primary text-primary-foreground shadow-xs",
                    !isActive && isClickable && "hover:bg-muted",
                    !isClickable && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "relative flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold border transition-colors",
                      isCompleted &&
                        !isActive &&
                        "bg-emerald-500 border-emerald-500 text-white",
                      isActive && "border-primary-foreground/70 bg-primary-foreground/15",
                      !isCompleted &&
                        !isActive &&
                        status === "upcoming" &&
                        "border-primary/60 text-primary",
                      !isCompleted &&
                        !isActive &&
                        status === "locked" &&
                        "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {/* Pulsing ring on the active step */}
                    {isActive && (
                      <span
                        aria-hidden
                        className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground/40"
                      />
                    )}
                    <span className="relative">
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : status === "locked" ? (
                        <Lock className="w-3 h-3" />
                      ) : (
                        step.id
                      )}
                    </span>
                  </span>
                  <span className="hidden md:inline text-sm font-medium">
                    {step.name}
                  </span>
                </button>
                {index < WORKFLOW_STEPS.length - 1 && (
                  <div className="w-8 h-0.5 mx-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        connectorFilled
                          ? "w-full bg-linear-to-r/srgb from-emerald-500 to-emerald-400"
                          : "w-0"
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <span className="hidden lg:block text-xs text-muted-foreground tabular-nums">
          {maxCompletedStep}/{totalSteps} complete
        </span>
      </nav>

      {/* Global progress bar */}
      <div
        className="h-1 w-full bg-muted"
        role="progressbar"
        aria-valuenow={maxCompletedStep}
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-label="Workflow progress"
        data-testid="workflow-progress"
      >
        <div
          className="h-full bg-linear-to-r/srgb from-indigo-500 to-violet-500 transition-[width] duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
          data-testid="workflow-progress-fill"
        />
      </div>
    </div>
  );
}
