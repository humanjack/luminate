"use client";

import Link from "next/link";
import { CheckCircle2, AlertCircle, AlertTriangle, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RadialScore } from "@/components/workflow/charts/radial-score";
import type { ScoreTone } from "@/components/workflow/charts/score-color";
import type { ReadinessReport } from "@/lib/readiness";

const STATUS_TONE: Record<ReadinessReport["status"], ScoreTone> = {
  ok: "good",
  warning: "ok",
  error: "bad",
};

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

  const total = totals.slides;
  const ready = slides.filter((s) => s.status !== "error").length;
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0;

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
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-4">
          <RadialScore
            value={pct}
            display={`${ready}/${total}`}
            caption="slides ready"
            showLabel={false}
            tone={STATUS_TONE[status]}
            size={104}
            stroke={9}
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {status === "ok" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : status === "warning" ? (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              )}
              <h3 className="text-sm font-medium" data-testid="readiness-status">
                {status === "ok"
                  ? "Ready to export"
                  : status === "warning"
                  ? "Export is allowed with warnings"
                  : "Export blocked — fix the issues below"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
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
            <div className="flex flex-wrap gap-1.5" data-testid="readiness-checklist">
              <ChecklistChip label="Slides" done={total} of={total} alwaysComplete />
              <ChecklistChip label="Script" done={totals.withScript} of={total} />
              <ChecklistChip label="Audio" done={totals.withAudio} of={total} />
            </div>
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

function ChecklistChip({
  label,
  done,
  of,
  alwaysComplete,
}: {
  label: string;
  done: number;
  of: number;
  alwaysComplete?: boolean;
}) {
  const complete = of > 0 && (alwaysComplete || done >= of);
  return (
    <span
      data-testid={`readiness-chip-${label.toLowerCase()}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        complete
          ? "border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-border bg-muted/50 text-muted-foreground"
      )}
    >
      {complete ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <Circle className="h-3 w-3" />
      )}
      {label} {done}/{of}
    </span>
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
          ? "bg-red-50/60 border-red-200 dark:bg-red-950/30 dark:border-red-900"
          : "bg-amber-50/60 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900"
      )}
    >
      {tone === "error" ? (
        <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
      )}
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
