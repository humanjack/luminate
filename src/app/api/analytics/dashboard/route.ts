import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import {
  db,
  projects,
  researchData,
  contentData,
  slides,
  scripts,
  recordings,
  analysisResults,
  videos,
} from "@/lib/db";
import {
  computeDashboard,
  type ProjectAnalyticsInput,
} from "@/lib/analytics/aggregate";

export const runtime = "nodejs";

async function countByProject(
  table: typeof slides | typeof scripts | typeof recordings | typeof analysisResults | typeof videos
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      projectId: table.projectId,
      n: sql<number>`count(*)`,
    })
    .from(table)
    .groupBy(table.projectId);
  return new Map(rows.map((r) => [r.projectId, Number(r.n)]));
}

export async function GET() {
  const allProjects = await db.select().from(projects);
  if (allProjects.length === 0) {
    return NextResponse.json(
      computeDashboard([]),
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Existence flags for the one-to-one tables
  const researchRows = await db
    .select({ projectId: researchData.projectId })
    .from(researchData);
  const contentRows = await db
    .select({ projectId: contentData.projectId })
    .from(contentData);

  const researchSet = new Set(researchRows.map((r) => r.projectId));
  const contentSet = new Set(contentRows.map((r) => r.projectId));

  // Counts for the many-tables
  const [slideC, scriptC, recordingC, analysisC, videoC] = await Promise.all([
    countByProject(slides),
    countByProject(scripts),
    countByProject(recordings),
    countByProject(analysisResults),
    countByProject(videos),
  ]);

  const inputs: ProjectAnalyticsInput[] = allProjects.map((p) => ({
    id: p.id,
    name: p.name,
    currentStep: p.currentStep,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    hasResearch: researchSet.has(p.id),
    hasContent: contentSet.has(p.id),
    slideCount: slideC.get(p.id) ?? 0,
    scriptCount: scriptC.get(p.id) ?? 0,
    recordingCount: recordingC.get(p.id) ?? 0,
    analysisCount: analysisC.get(p.id) ?? 0,
    videoCount: videoC.get(p.id) ?? 0,
  }));

  const snapshot = computeDashboard(inputs);
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
