import { NextRequest, NextResponse } from "next/server";
import { db, recordings, projects } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/recordings - Save (or replace) a per-slide recording
//
// Requires either `audioData` (base64) or an `audioPath` that already exists on
// disk. Recordings with neither are rejected so empty stubs can't pile up.
//
// When `slideIndex` is provided and a recording already exists for that slide
// in this project, the existing row + its audio file are removed first so
// re-records replace cleanly rather than accumulate.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    if (typeof body.duration !== "number" || body.duration <= 0) {
      return NextResponse.json(
        { error: "Recording duration must be a positive number" },
        { status: 400 }
      );
    }

    if (!body.audioData && !body.audioPath) {
      return NextResponse.json(
        { error: "Recording is missing audio data; cannot save empty stub" },
        { status: 400 }
      );
    }

    const now = new Date();
    const recordingId = uuid();

    let audioPath: string = body.audioPath ?? "";
    if (body.audioData && !body.audioPath) {
      const recordingsDir = path.join(process.cwd(), "public", "recordings", projectId);
      await mkdir(recordingsDir, { recursive: true });

      const fileName = `${recordingId}.webm`;
      audioPath = `/recordings/${projectId}/${fileName}`;
      const filePath = path.join(recordingsDir, fileName);

      const audioBuffer = Buffer.from(body.audioData, "base64");
      if (audioBuffer.byteLength === 0) {
        return NextResponse.json(
          { error: "Recording audio is empty" },
          { status: 400 }
        );
      }
      await writeFile(filePath, audioBuffer);
    }

    // Replace any prior recording for the same slide so re-records overwrite
    if (typeof body.slideIndex === "number") {
      const prior = await db
        .select()
        .from(recordings)
        .where(
          and(
            eq(recordings.projectId, projectId),
            eq(recordings.slideIndex, body.slideIndex)
          )
        );
      for (const old of prior) {
        if (old.audioPath?.startsWith("/recordings/")) {
          const absolute = path.join(process.cwd(), "public", old.audioPath);
          await unlink(absolute).catch(() => undefined);
        }
        await db.delete(recordings).where(eq(recordings.id, old.id));
      }
    }

    const [created] = await db
      .insert(recordings)
      .values({
        id: recordingId,
        projectId,
        slideId: body.slideId,
        slideIndex: body.slideIndex,
        audioPath,
        duration: body.duration,
        waveformData: body.waveformData,
        createdAt: now,
      })
      .returning();

    // Advance the project to the analysis step once at least one recording exists
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

// GET /api/projects/[id]/recordings - List recordings for a project
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const rows = await db
      .select()
      .from(recordings)
      .where(eq(recordings.projectId, projectId));
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Failed to load recordings:", error);
    return NextResponse.json(
      { error: "Failed to load recordings" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/recordings - Delete all recordings for a project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    const existing = await db
      .select()
      .from(recordings)
      .where(eq(recordings.projectId, projectId));
    for (const r of existing) {
      if (r.audioPath?.startsWith("/recordings/")) {
        const absolute = path.join(process.cwd(), "public", r.audioPath);
        await unlink(absolute).catch(() => undefined);
      }
    }
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
