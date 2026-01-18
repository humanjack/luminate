import { NextRequest, NextResponse } from "next/server";
import { db, scripts, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/scripts - Save scripts
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const { scripts: scriptsData } = body;

    if (!Array.isArray(scriptsData)) {
      return NextResponse.json(
        { error: "Scripts must be an array" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Delete existing scripts
    await db.delete(scripts).where(eq(scripts.projectId, projectId));

    // Insert new scripts
    const newScripts = await Promise.all(
      scriptsData.map(async (script: any) => {
        const [created] = await db
          .insert(scripts)
          .values({
            id: script.id || uuid(),
            projectId,
            slideId: script.slideId,
            slideIndex: script.slideIndex,
            text: script.text,
            speakerNotes: script.speakerNotes,
            estimatedDuration: script.estimatedDuration,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        return created;
      })
    );

    // Update project step
    await db
      .update(projects)
      .set({ currentStep: 5, updatedAt: now })
      .where(eq(projects.id, projectId));

    return NextResponse.json(newScripts);
  } catch (error) {
    console.error("Failed to save scripts:", error);
    return NextResponse.json(
      { error: "Failed to save scripts" },
      { status: 500 }
    );
  }
}
