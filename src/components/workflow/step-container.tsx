"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StepContainerProps {
  title: string;
  description?: string;
  icon?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function StepContainer({
  title,
  description,
  icon,
  children,
  className,
  actions,
}: StepContainerProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          {icon && <span className="text-2xl">{icon}</span>}
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
