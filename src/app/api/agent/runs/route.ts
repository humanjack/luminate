import { NextRequest, NextResponse } from "next/server";
import { db, agentRuns, agentSteps } from "@/lib/db";
import { desc, eq } from "drizzle-orm";

export const runtime = "nodejs";

// GET /api/agent/runs?projectId=xxx — list runs (most recent first) with their steps
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const runs = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.projectId, projectId))
    .orderBy(desc(agentRuns.startedAt))
    .limit(20);

  const withSteps = await Promise.all(
    runs.map(async (run) => {
      const steps = await db
        .select()
        .from(agentSteps)
        .where(eq(agentSteps.runId, run.id));
      return { ...run, steps };
    })
  );

  return NextResponse.json(withSteps);
}
