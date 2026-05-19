// Pure aggregation functions used by the dashboard.
// Everything in here is testable without a DB — pass in the raw rows
// from your existing Drizzle queries.

export interface ProjectAnalyticsInput {
  id: string;
  name: string;
  currentStep: number;
  status: "draft" | "in_progress" | "completed";
  createdAt: Date | number;
  updatedAt: Date | number;
  hasResearch?: boolean;
  hasContent?: boolean;
  slideCount?: number;
  scriptCount?: number;
  recordingCount?: number;
  analysisCount?: number;
  videoCount?: number;
}

export interface ProjectStats {
  id: string;
  name: string;
  status: "draft" | "in_progress" | "completed";
  completionPct: number;     // 0-100
  currentStep: number;       // 1-7
  stagesDone: number;        // 0-7
  blockers: number;          // count of stages with prereqs but no progress
  ageDays: number;
  updatedAt: number;
}

const STAGE_GATES = (input: ProjectAnalyticsInput): boolean[] => [
  Boolean(input.hasResearch),
  Boolean(input.hasContent),
  (input.slideCount ?? 0) > 0,
  (input.scriptCount ?? 0) > 0,
  (input.recordingCount ?? 0) > 0,
  (input.analysisCount ?? 0) > 0,
  (input.videoCount ?? 0) > 0,
];

const toMs = (v: Date | number): number =>
  v instanceof Date ? v.getTime() : v;

export function computeProjectStats(input: ProjectAnalyticsInput): ProjectStats {
  const gates = STAGE_GATES(input);
  const stagesDone = gates.filter(Boolean).length;
  const completionPct = Math.round((stagesDone / gates.length) * 100);

  // A blocker is a stage that is NOT done but whose previous stage IS done.
  let blockers = 0;
  for (let i = 0; i < gates.length; i++) {
    if (!gates[i] && (i === 0 || gates[i - 1])) blockers++;
  }
  // The very last not-done stage is the next-action, not a blocker per se;
  // we keep them as "open work" to surface stuck states clearly.

  const now = Date.now();
  const ageDays = Math.max(
    0,
    Math.floor((now - toMs(input.createdAt)) / (1000 * 60 * 60 * 24))
  );

  return {
    id: input.id,
    name: input.name,
    status: input.status,
    completionPct,
    currentStep: input.currentStep,
    stagesDone,
    blockers,
    ageDays,
    updatedAt: toMs(input.updatedAt),
  };
}

export interface DashboardSnapshot {
  totalProjects: number;
  byStatus: Record<"draft" | "in_progress" | "completed", number>;
  byStep: number[];                  // index = step 1..7 → count
  completionAvg: number;             // 0..100, avg completionPct
  recentlyUpdated: ProjectStats[];   // top 5 by updatedAt
  blockedProjects: ProjectStats[];   // top 5 with most blockers
  newProjectsLastWeek: number;
  completedProjectsLastWeek: number;
  weeklyTrend: number[];             // last 8 weeks: project count completed each week
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function computeDashboard(
  inputs: ProjectAnalyticsInput[],
  now: number = Date.now()
): DashboardSnapshot {
  const stats = inputs.map(computeProjectStats);

  const byStatus = { draft: 0, in_progress: 0, completed: 0 };
  const byStep: number[] = [0, 0, 0, 0, 0, 0, 0, 0]; // indexes 0..7 (0 unused)

  for (const s of stats) {
    byStatus[s.status]++;
    const step = Math.min(7, Math.max(1, s.currentStep));
    byStep[step]++;
  }

  const completionAvg =
    stats.length === 0
      ? 0
      : Math.round(stats.reduce((a, b) => a + b.completionPct, 0) / stats.length);

  const recentlyUpdated = [...stats]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  const blockedProjects = [...stats]
    .filter((s) => s.status !== "completed")
    .sort((a, b) => b.blockers - a.blockers)
    .slice(0, 5);

  const newProjectsLastWeek = inputs.filter(
    (p) => now - toMs(p.createdAt) <= WEEK_MS
  ).length;

  const completedProjectsLastWeek = inputs.filter(
    (p) => p.status === "completed" && now - toMs(p.updatedAt) <= WEEK_MS
  ).length;

  // Build 8-week sparkline of project completions, oldest → newest
  const weeklyTrend: number[] = new Array(8).fill(0);
  for (const p of inputs) {
    if (p.status !== "completed") continue;
    const ageMs = now - toMs(p.updatedAt);
    const bucket = Math.floor(ageMs / WEEK_MS);
    if (bucket < 0 || bucket >= 8) continue;
    // bucket 0 = this week, 7 = 8 weeks ago. Reverse so newest is last.
    weeklyTrend[7 - bucket]++;
  }

  return {
    totalProjects: inputs.length,
    byStatus,
    byStep,
    completionAvg,
    recentlyUpdated,
    blockedProjects,
    newProjectsLastWeek,
    completedProjectsLastWeek,
    weeklyTrend,
  };
}
