"use client";

import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TrustSummaryData {
  total: number;
  supported: number;
  unsupported: number;
  unverifiable: number;
  groundedRatio: number;
}

export interface ClaimVerdict {
  claimId: string;
  status: "supported" | "unsupported" | "unverifiable";
  evidence?: string;
}

interface TrustSummaryProps {
  summary: TrustSummaryData | null;
  verdicts: ClaimVerdict[];
  claimText: Record<string, string>;
  isVerifying: boolean;
  onVerify: () => void;
  /** Grounded ratio below this is surfaced as a warning. */
  threshold?: number;
}

/**
 * Citation grounding trust report (Phase 3, #47). Shows how many claims are
 * verified-supported vs unsupported/unverifiable, and lists the weak ones so
 * the user can fix them before continuing.
 */
export function TrustSummary({
  summary,
  verdicts,
  claimText,
  isVerifying,
  onVerify,
  threshold = 0.6,
}: TrustSummaryProps) {
  const weak = verdicts.filter((v) => v.status !== "supported");
  const below = summary !== null && summary.total > 0 && summary.groundedRatio < threshold;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {below ? (
            <ShieldAlert className="h-4 w-4 text-yellow-500" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-green-500" />
          )}
          Citation grounding
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onVerify} disabled={isVerifying}>
          {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify citations"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary === null ? (
          <p className="text-sm text-muted-foreground">
            Run verification to check each claim against its cited source.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-green-600 dark:text-green-400">
                ✓ {summary.supported} supported
              </span>
              <span className="text-red-600 dark:text-red-400">
                ✗ {summary.unsupported} unsupported
              </span>
              <span className="text-muted-foreground">
                ? {summary.unverifiable} unverifiable
              </span>
              <span
                className={cn(
                  "ml-auto font-medium",
                  below ? "text-yellow-600 dark:text-yellow-400" : "text-foreground",
                )}
              >
                {Math.round(summary.groundedRatio * 100)}% grounded
              </span>
            </div>

            {below && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Many claims aren&apos;t backed by their cited sources. Consider regenerating or
                adding sources before continuing.
              </p>
            )}

            {weak.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {weak.slice(0, 8).map((v) => (
                  <li key={v.claimId} className="flex gap-2">
                    <span className={v.status === "unsupported" ? "text-red-500" : "text-muted-foreground"}>
                      {v.status === "unsupported" ? "✗" : "?"}
                    </span>
                    <span className="line-clamp-2">{claimText[v.claimId] ?? v.claimId}</span>
                  </li>
                ))}
                {weak.length > 8 && <li>…and {weak.length - 8} more</li>}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
