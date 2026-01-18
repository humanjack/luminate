import { NextRequest, NextResponse } from "next/server";
import { db, videos, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/video - Save video data
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    const now = new Date();

    const [created] = await db
      .insert(videos)
      .values({
        id: uuid(),
        projectId,
        outputPath: body.outputPath,
        duration: body.duration,
        resolution: body.resolution || "1920x1080",
        status: body.status || "pending",
        progress: body.progress || 0,
        youtubeUrl: body.youtubeUrl,
        youtubeVideoId: body.youtubeVideoId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Update project status
    await db
      .update(projects)
      .set({ status: "completed", updatedAt: now })
      .where(eq(projects.id, projectId));

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to save video:", error);
    return NextResponse.json(
      { error: "Failed to save video" },
      { status: 500 }
    );
  }
}
