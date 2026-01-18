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
  const { canNavigateTo, getStepStatus, setCurrentStep } = useWorkflowStore();

  const currentPath = pathname.split("/").pop();

  const handleStepClick = (step: (typeof WORKFLOW_STEPS)[number]) => {
    if (canNavigateTo(step.id as WorkflowStepId)) {
      setCurrentStep(step.id as WorkflowStepId);
      router.push(`/projects/${projectId}/${step.path}`);
    }
  };

  return (
    <nav className="flex items-center justify-between px-4 py-3 border-b bg-card">
      <div className="flex items-center gap-1">
        {WORKFLOW_STEPS.map((step, index) => {
          const status = getStepStatus(step.id as WorkflowStepId);
          const isActive = currentPath === step.path;
          const isClickable = canNavigateTo(step.id as WorkflowStepId);

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => handleStepClick(step)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                  isActive && "bg-primary text-primary-foreground",
                  !isActive && isClickable && "hover:bg-muted",
                  !isClickable && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium border">
                  {status === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : status === "locked" ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    step.id
                  )}
                </span>
                <span className="hidden md:inline text-sm font-medium">
                  {step.name}
                </span>
              </button>
              {index < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-0.5 mx-1",
                    status === "completed" ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
