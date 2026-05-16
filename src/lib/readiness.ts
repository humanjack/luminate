import type {
  Slide,
  Script,
  Recording,
  OutlineItem,
  Claim,
} from "@/lib/db/schema";

export type ReadinessSeverity = "error" | "warning" | "ok";

export type ReadinessTopic =
  | "slide-empty"
  | "script-missing"
  | "audio-missing"
  | "duration-mismatch"
  | "unsupported-claim"
  | "outline-unapproved";

export interface ReadinessIssue {
  slideIndex?: number;
  topic: ReadinessTopic;
  severity: ReadinessSeverity;
  message: string;
  /** Workflow step to jump to in order to fix this. 1=research…7=video */
  jumpToStep: number;
}

export interface SlideReadiness {
  slideIndex: number;
  status: ReadinessSeverity;
  issues: ReadinessIssue[];
  scriptDuration: number | null;
  audioDuration: number | null;
}

export interface ReadinessReport {
  status: ReadinessSeverity;
  slides: SlideReadiness[];
  project: ReadinessIssue[];
  totals: {
    slides: number;
    withAudio: number;
    withScript: number;
    errors: number;
    warnings: number;
  };
  /** True when all `error` severity issues are resolved. */
  canExport: boolean;
}

export interface ReadinessInput {
  slides: Slide[];
  scripts: Script[];
  recordings: Recording[];
  outlineItems?: OutlineItem[];
  claims?: Claim[];
}

const DURATION_TOLERANCE_PCT = 0.25;
const DURATION_TOLERANCE_SECONDS = 3;

/**
 * Compute the readiness report for the project's export pipeline (#6).
 *
 * Rules:
 * - Each slide needs non-empty content, a script with text, and a saved
 *   recording with audio duration > 0.
 * - Script estimatedDuration vs. recording duration must agree within
 *   max(3s, 25%). Mismatch is a warning, not an error.
 * - Outline items must all be approved (error if any unapproved exist).
 * - Claims with empty source links produce project-level warnings.
 */
export function computeReadiness(input: ReadinessInput): ReadinessReport {
  const { slides, scripts, recordings, outlineItems = [], claims = [] } = input;
  const slidesSorted = [...slides].sort((a, b) => a.index - b.index);

  const scriptBySlide = new Map<number, Script>();
  for (const s of scripts) scriptBySlide.set(s.slideIndex, s);
  const recordingBySlide = new Map<number, Recording>();
  for (const r of recordings) {
    if (typeof r.slideIndex === "number" && r.audioPath) {
      recordingBySlide.set(r.slideIndex, r);
    }
  }

  const slideReports: SlideReadiness[] = slidesSorted.map((slide) => {
    const issues: ReadinessIssue[] = [];
    if (!slide.markdown.trim()) {
      issues.push({
        slideIndex: slide.index,
        topic: "slide-empty",
        severity: "error",
        message: `Slide ${slide.index + 1} has no content`,
        jumpToStep: 3,
      });
    }
    const script = scriptBySlide.get(slide.index);
    if (!script || !script.text?.trim()) {
      issues.push({
        slideIndex: slide.index,
        topic: "script-missing",
        severity: "error",
        message: `Slide ${slide.index + 1} is missing a script`,
        jumpToStep: 4,
      });
    }
    const recording = recordingBySlide.get(slide.index);
    if (!recording || !recording.duration || recording.duration <= 0) {
      issues.push({
        slideIndex: slide.index,
        topic: "audio-missing",
        severity: "error",
        message: `Slide ${slide.index + 1} has no recorded audio`,
        jumpToStep: 5,
      });
    } else if (script?.estimatedDuration && recording.duration) {
      const expected = script.estimatedDuration;
      const actual = recording.duration;
      const delta = Math.abs(expected - actual);
      const tolerance = Math.max(
        DURATION_TOLERANCE_SECONDS,
        expected * DURATION_TOLERANCE_PCT
      );
      if (delta > tolerance) {
        issues.push({
          slideIndex: slide.index,
          topic: "duration-mismatch",
          severity: "warning",
          message: `Slide ${slide.index + 1} recording is ${
            actual > expected ? "longer" : "shorter"
          } than the script (${actual.toFixed(1)}s vs. ${expected}s expected)`,
          jumpToStep: 5,
        });
      }
    }
    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;
    const status: ReadinessSeverity =
      errors > 0 ? "error" : warnings > 0 ? "warning" : "ok";

    return {
      slideIndex: slide.index,
      status,
      issues,
      scriptDuration: script?.estimatedDuration ?? null,
      audioDuration: recording?.duration ?? null,
    };
  });

  const projectIssues: ReadinessIssue[] = [];
  if (outlineItems.length > 0) {
    const unapproved = outlineItems.filter((o) => !o.approved).length;
    if (unapproved > 0) {
      projectIssues.push({
        topic: "outline-unapproved",
        severity: "error",
        message: `${unapproved} outline item${unapproved > 1 ? "s" : ""} not approved`,
        jumpToStep: 2,
      });
    }
  }
  const unsupportedClaims = claims.filter((c) => c.sourceIds.length === 0).length;
  if (unsupportedClaims > 0) {
    projectIssues.push({
      topic: "unsupported-claim",
      severity: "warning",
      message: `${unsupportedClaims} claim${
        unsupportedClaims > 1 ? "s" : ""
      } without source backing`,
      jumpToStep: 1,
    });
  }
  if (slidesSorted.length === 0) {
    projectIssues.push({
      topic: "slide-empty",
      severity: "error",
      message: "No slides have been generated yet",
      jumpToStep: 3,
    });
  }

  const errorsTotal =
    slideReports.reduce(
      (n, r) => n + r.issues.filter((i) => i.severity === "error").length,
      0
    ) + projectIssues.filter((i) => i.severity === "error").length;
  const warningsTotal =
    slideReports.reduce(
      (n, r) => n + r.issues.filter((i) => i.severity === "warning").length,
      0
    ) + projectIssues.filter((i) => i.severity === "warning").length;

  const overall: ReadinessSeverity =
    errorsTotal > 0 ? "error" : warningsTotal > 0 ? "warning" : "ok";

  return {
    status: overall,
    slides: slideReports,
    project: projectIssues,
    totals: {
      slides: slidesSorted.length,
      withAudio: slideReports.filter((r) =>
        r.audioDuration != null && r.audioDuration > 0
      ).length,
      withScript: slideReports.filter((r) => r.scriptDuration != null).length,
      errors: errorsTotal,
      warnings: warningsTotal,
    },
    canExport: errorsTotal === 0,
  };
}
