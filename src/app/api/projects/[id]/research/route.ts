import { NextRequest, NextResponse } from "next/server";
import { db, researchData, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/research - Save research data
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    // Check if research data already exists for this project
    const [existing] = await db
      .select()
      .from(researchData)
      .where(eq(researchData.projectId, projectId));

    const now = new Date();

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(researchData)
        .set({
          ...body,
          updatedAt: now,
        })
        .where(eq(researchData.id, existing.id))
        .returning();

      // Update project step if moving forward
      await db
        .update(projects)
        .set({ currentStep: 2, updatedAt: now })
        .where(eq(projects.id, projectId));

      return NextResponse.json(updated);
    } else {
      // Create new
      const [created] = await db
        .insert(researchData)
        .values({
          id: uuid(),
          projectId,
          topic: body.topic,
          depth: body.depth || "detailed",
          content: body.content,
          sources: body.sources,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Update project step
      await db
        .update(projects)
        .set({ currentStep: 2, updatedAt: now })
        .where(eq(projects.id, projectId));

      return NextResponse.json(created, { status: 201 });
    }
  } catch (error) {
    console.error("Failed to save research data:", error);
    return NextResponse.json(
      { error: "Failed to save research data" },
      { status: 500 }
    );
  }
}
