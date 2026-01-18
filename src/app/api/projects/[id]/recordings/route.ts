import { NextRequest, NextResponse } from "next/server";
import { db, recordings, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/recordings - Save a recording
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    const now = new Date();
    const recordingId = uuid();

    // If audioData is provided as base64, save it to a file
    let audioPath = body.audioPath;
    if (body.audioData && !audioPath) {
      const recordingsDir = path.join(process.cwd(), "public", "recordings", projectId);
      await mkdir(recordingsDir, { recursive: true });

      const fileName = `${recordingId}.webm`;
      audioPath = `/recordings/${projectId}/${fileName}`;
      const filePath = path.join(recordingsDir, fileName);

      // Convert base64 to buffer and save
      const audioBuffer = Buffer.from(body.audioData, "base64");
      await writeFile(filePath, audioBuffer);
    }

    const [created] = await db
      .insert(recordings)
      .values({
        id: recordingId,
        projectId,
        slideId: body.slideId,
        slideIndex: body.slideIndex,
        audioPath: audioPath || "",
        duration: body.duration,
        waveformData: body.waveformData,
        createdAt: now,
      })
      .returning();

    // Update project step
    await db
      .update(projects)
      .set({ currentStep: 6, updatedAt: now })
      .where(eq(projects.id, projectId));

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to save recording:", error);
    return NextResponse.json(
      { error: "Failed to save recording" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/recordings - Delete all recordings for a project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    await db.delete(recordings).where(eq(recordings.projectId, projectId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete recordings:", error);
    return NextResponse.json(
      { error: "Failed to delete recordings" },
      { status: 500 }
    );
  }
}
