import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icon node (e.g. a lucide icon); rendered inside a soft tinted circle. */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Primary CTA / actions slot. */
  action?: ReactNode;
  /** Optional secondary hint under the action. */
  hint?: ReactNode;
  className?: string;
  /** Compact variant for in-card / smaller contexts. */
  size?: "default" | "sm";
}

/**
 * Consistent, polished empty / zero-data state: a tinted icon badge, a title,
 * an optional description, and an optional CTA. Used across the app so empty
 * surfaces feel intentional rather than unfinished.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  hint,
  className,
  size = "default",
}: EmptyStateProps) {
  const compact = size === "sm";
  return (
    <div
      data-testid="empty-state"
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "py-8 gap-2" : "py-12 gap-3",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-primary/10 text-primary",
            compact ? "h-12 w-12" : "h-16 w-16"
          )}
        >
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className={cn("font-semibold", compact ? "text-base" : "text-lg")}>
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1 flex items-center gap-2">{action}</div>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
