import { describe, expect, it } from "vitest";
import {
  computeDashboard,
  computeProjectStats,
  type ProjectAnalyticsInput,
} from "@/lib/analytics/aggregate";

const NOW = new Date("2026-05-17T00:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

function mkProject(overrides: Partial<ProjectAnalyticsInput>): ProjectAnalyticsInput {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    name: overrides.name ?? "Project",
    currentStep: overrides.currentStep ?? 1,
    status: overrides.status ?? "draft",
    createdAt: overrides.createdAt ?? NOW - DAY,
    updatedAt: overrides.updatedAt ?? NOW - DAY,
    hasResearch: overrides.hasResearch ?? false,
    hasContent: overrides.hasContent ?? false,
    slideCount: overrides.slideCount ?? 0,
    scriptCount: overrides.scriptCount ?? 0,
    recordingCount: overrides.recordingCount ?? 0,
    analysisCount: overrides.analysisCount ?? 0,
    videoCount: overrides.videoCount ?? 0,
  };
}

describe("analytics/computeProjectStats", () => {
  it("scores 0 for a fresh project", () => {
    const s = computeProjectStats(mkProject({}));
    expect(s.completionPct).toBe(0);
    expect(s.stagesDone).toBe(0);
  });

  it("scores 100 once every stage has produced output", () => {
    const s = computeProjectStats(
      mkProject({
        hasResearch: true,
        hasContent: true,
        slideCount: 3,
        scriptCount: 3,
        recordingCount: 3,
        analysisCount: 3,
        videoCount: 1,
      })
    );
    expect(s.stagesDone).toBe(7);
    expect(s.completionPct).toBe(100);
    expect(s.blockers).toBe(0);
  });

  it("counts a blocker when the next stage is gated but ready", () => {
    const s = computeProjectStats(
      mkProject({ hasResearch: true, hasContent: true })
    );
    // Stages: research ✓, content ✓, slides ✗ (next + ready) — that's 1 blocker.
    // Everything past that is also waiting but their immediate predecessor
    // isn't done, so they don't count.
    expect(s.blockers).toBe(1);
  });

  it("ageDays never goes negative for future-dated rows", () => {
    const s = computeProjectStats(
      mkProject({ createdAt: Date.now() + 10 * DAY })
    );
    expect(s.ageDays).toBeGreaterThanOrEqual(0);
  });
});

describe("analytics/computeDashboard", () => {
  it("returns an empty snapshot for no projects", () => {
    const snap = computeDashboard([]);
    expect(snap.totalProjects).toBe(0);
    expect(snap.completionAvg).toBe(0);
    expect(snap.byStatus).toEqual({ draft: 0, in_progress: 0, completed: 0 });
    expect(snap.byStep.every((n) => n === 0)).toBe(true);
  });

  it("buckets projects by status and current step", () => {
    const snap = computeDashboard(
      [
        mkProject({ status: "draft", currentStep: 1 }),
        mkProject({ status: "in_progress", currentStep: 3 }),
        mkProject({ status: "in_progress", currentStep: 3 }),
        mkProject({ status: "completed", currentStep: 7 }),
      ],
      NOW
    );
    expect(snap.totalProjects).toBe(4);
    expect(snap.byStatus).toEqual({ draft: 1, in_progress: 2, completed: 1 });
    expect(snap.byStep[3]).toBe(2);
    expect(snap.byStep[7]).toBe(1);
  });

  it("counts new and completed projects within the last week", () => {
    const snap = computeDashboard(
      [
        mkProject({ createdAt: NOW - 2 * DAY }),                                  // new
        mkProject({ createdAt: NOW - 10 * DAY }),                                 // not new
        mkProject({ status: "completed", updatedAt: NOW - 3 * DAY, createdAt: NOW - 30 * DAY }), // completed this week
        mkProject({ status: "completed", updatedAt: NOW - 20 * DAY, createdAt: NOW - 60 * DAY }), // older completion
      ],
      NOW
    );
    expect(snap.newProjectsLastWeek).toBe(1);
    expect(snap.completedProjectsLastWeek).toBe(1);
  });

  it("builds an 8-week trend with this week on the right", () => {
    const snap = computeDashboard(
      [
        mkProject({ status: "completed", updatedAt: NOW - 0.5 * DAY, createdAt: NOW - 30 * DAY }),
        mkProject({ status: "completed", updatedAt: NOW - 1 * WEEK, createdAt: NOW - 30 * DAY }),
        mkProject({ status: "completed", updatedAt: NOW - 2 * WEEK, createdAt: NOW - 30 * DAY }),
      ],
      NOW
    );
    expect(snap.weeklyTrend.length).toBe(8);
    // most recent bucket (rightmost) holds 1 (the half-day-old completion)
    expect(snap.weeklyTrend[7]).toBe(1);
    expect(snap.weeklyTrend[6]).toBe(1);
    expect(snap.weeklyTrend[5]).toBe(1);
  });

  it("recentlyUpdated is sorted newest first and capped at 5", () => {
    const inputs = Array.from({ length: 8 }, (_, i) =>
      mkProject({ id: `p${i}`, updatedAt: NOW - i * DAY })
    );
    const snap = computeDashboard(inputs);
    expect(snap.recentlyUpdated.map((p) => p.id)).toEqual([
      "p0",
      "p1",
      "p2",
      "p3",
      "p4",
    ]);
  });

  it("blockedProjects excludes completed projects", () => {
    const snap = computeDashboard(
      [
        mkProject({ id: "active-1", status: "in_progress" }),
        mkProject({ id: "active-2", status: "in_progress", hasResearch: true }),
        mkProject({
          id: "done",
          status: "completed",
          hasResearch: true,
          hasContent: true,
          slideCount: 1,
          scriptCount: 1,
          recordingCount: 1,
          analysisCount: 1,
          videoCount: 1,
        }),
      ],
      NOW
    );
    const ids = snap.blockedProjects.map((p) => p.id);
    expect(ids).not.toContain("done");
    expect(ids).toContain("active-1");
    expect(ids).toContain("active-2");
    // All non-completed projects have at least one open stage
    expect(snap.blockedProjects.every((p) => p.blockers >= 1)).toBe(true);
  });
});
