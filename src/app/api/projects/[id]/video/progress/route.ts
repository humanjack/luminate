import { NextRequest, NextResponse } from "next/server";
import { db, videos } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/projects/[id]/video/progress - Update video progress
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    // Get the latest video for this project
    const [latestVideo] = await db
      .select()
      .from(videos)
      .where(eq(videos.projectId, projectId))
      .orderBy(desc(videos.createdAt))
      .limit(1);

    if (!latestVideo) {
      return NextResponse.json(
        { error: "No video found for this project" },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(videos)
      .set({
        progress: body.progress,
        status: body.status,
        outputPath: body.outputPath,
        errorMessage: body.errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, latestVideo.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update video progress:", error);
    return NextResponse.json(
      { error: "Failed to update video progress" },
      { status: 500 }
    );
  }
}
