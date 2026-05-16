"use client";

import Link from "next/link";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReadinessReport } from "@/lib/readiness";

const STEP_HREFS: Record<number, { href: string; label: string }> = {
  1: { href: "research", label: "Research" },
  2: { href: "content", label: "Outline" },
  3: { href: "slides", label: "Slides" },
  4: { href: "script", label: "Script" },
  5: { href: "recording", label: "Recording" },
  6: { href: "analysis", label: "Analysis" },
  7: { href: "video", label: "Video" },
};

export interface ReadinessPanelProps {
  projectId: string;
  report: ReadinessReport;
}

export function ReadinessPanel({ projectId, report }: ReadinessPanelProps) {
  const { slides, project, totals, canExport, status } = report;
  const allIssues = [...project, ...slides.flatMap((s) => s.issues)];
  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");

  return (
    <Card
      data-testid="readiness-panel"
      className={cn(
        status === "error"
          ? "border-red-300"
          : status === "warning"
          ? "border-amber-300"
          : "border-emerald-300"
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5">
            {status === "ok" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : status === "warning" ? (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-medium" data-testid="readiness-status">
              {status === "ok"
                ? "Ready to export"
                : status === "warning"
                ? "Export is allowed with warnings"
                : "Export blocked — fix the issues below"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totals.slides} slide{totals.slides === 1 ? "" : "s"} ·{" "}
              {totals.withScript}/{totals.slides} with script ·{" "}
              {totals.withAudio}/{totals.slides} with audio
              {totals.errors > 0 && (
                <span className="ml-2 text-red-600" data-testid="error-count">
                  · {totals.errors} error{totals.errors > 1 ? "s" : ""}
                </span>
              )}
              {totals.warnings > 0 && (
                <span className="ml-2 text-amber-700" data-testid="warning-count">
                  · {totals.warnings} warning{totals.warnings > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="space-y-1" data-testid="readiness-errors">
            <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide">
              Errors
            </h4>
            <ul className="space-y-1">
              {errors.map((iss, i) => (
                <ReadinessRow
                  key={`err-${i}`}
                  projectId={projectId}
                  issue={iss}
                  tone="error"
                />
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-1" data-testid="readiness-warnings">
            <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Warnings
            </h4>
            <ul className="space-y-1">
              {warnings.map((iss, i) => (
                <ReadinessRow
                  key={`warn-${i}`}
                  projectId={projectId}
                  issue={iss}
                  tone="warning"
                />
              ))}
            </ul>
          </div>
        )}

        {canExport && errors.length === 0 && warnings.length === 0 && (
          <p className="text-xs text-emerald-700">
            Every slide has content, a script, and a saved recording. You can
            kick off the export below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ReadinessRow({
  projectId,
  issue,
  tone,
}: {
  projectId: string;
  issue: ReadinessReport["slides"][number]["issues"][number];
  tone: "error" | "warning";
}) {
  const target = STEP_HREFS[issue.jumpToStep];
  return (
    <li
      data-testid={`readiness-row-${issue.topic}`}
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1 text-sm",
        tone === "error"
          ? "bg-red-50/60 border-red-200"
          : "bg-amber-50/60 border-amber-200"
      )}
    >
      <span className="flex-1">{issue.message}</span>
      {target && (
        <Link href={`/projects/${projectId}/${target.href}`}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            data-testid={`readiness-jump-${issue.topic}`}
          >
            Go to {target.label}
          </Button>
        </Link>
      )}
    </li>
  );
}
