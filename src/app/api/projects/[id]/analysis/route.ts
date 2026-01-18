import { NextRequest, NextResponse } from "next/server";
import { db, analysisResults, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/analysis - Save analysis result
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    const now = new Date();

    const [created] = await db
      .insert(analysisResults)
      .values({
        id: uuid(),
        recordingId: body.recordingId,
        projectId,
        overallScore: body.overallScore,
        pronunciationScore: body.pronunciationScore,
        fluencyScore: body.fluencyScore,
        confidenceScore: body.confidenceScore,
        naturalnessScore: body.naturalnessScore,
        wordsPerMinute: body.wordsPerMinute,
        fillerWords: body.fillerWords,
        segments: body.segments,
        recommendations: body.recommendations,
        createdAt: now,
      })
      .returning();

    // Update project step
    await db
      .update(projects)
      .set({ currentStep: 7, updatedAt: now })
      .where(eq(projects.id, projectId));

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to save analysis result:", error);
    return NextResponse.json(
      { error: "Failed to save analysis result" },
      { status: 500 }
    );
  }
}
