import { NextRequest, NextResponse } from "next/server";
import { db, contentData, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/content - Save content data
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(contentData)
      .where(eq(contentData.projectId, projectId));

    const now = new Date();

    if (existing) {
      const [updated] = await db
        .update(contentData)
        .set({
          ...body,
          updatedAt: now,
        })
        .where(eq(contentData.id, existing.id))
        .returning();

      await db
        .update(projects)
        .set({ currentStep: 3, updatedAt: now })
        .where(eq(projects.id, projectId));

      return NextResponse.json(updated);
    } else {
      const [created] = await db
        .insert(contentData)
        .values({
          id: uuid(),
          projectId,
          title: body.title,
          format: body.format || "presentation",
          targetLength: body.targetLength || 10,
          outline: body.outline,
          markdown: body.markdown,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await db
        .update(projects)
        .set({ currentStep: 3, updatedAt: now })
        .where(eq(projects.id, projectId));

      return NextResponse.json(created, { status: 201 });
    }
  } catch (error) {
    console.error("Failed to save content data:", error);
    return NextResponse.json(
      { error: "Failed to save content data" },
      { status: 500 }
    );
  }
}
