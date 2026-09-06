import { NextRequest, NextResponse } from "next/server";
import { db, recordings, projects } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { mediaRoot } from "@/lib/paths";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB

// POST /api/projects/[id]/recordings - Save (or replace) a per-slide recording
//
// Requires `audioData` (base64). The server mints the on-disk path under
// public/recordings/<projectId>/ — a client-supplied `audioPath` is NOT
// accepted, since persisting an arbitrary path would later be read by the
// speech-analysis pipeline (arbitrary-file-read). Recordings without audio are
// rejected so empty stubs can't pile up.
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

    if (!body.audioData) {
      return NextResponse.json(
        { error: "Recording is missing audio data; cannot save empty stub" },
        { status: 400 }
      );
    }

    const now = new Date();
    const recordingId = uuid();

    const audioBuffer = Buffer.from(body.audioData, "base64");
    if (audioBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: "Recording audio is empty" },
        { status: 400 }
      );
    }
    if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Recording audio exceeds the 50MB limit" },
        { status: 413 }
      );
    }

    // Always a server-minted path under the managed recordings tree.
    const recordingsDir = path.join(mediaRoot(), "recordings", projectId);
    await mkdir(recordingsDir, { recursive: true });
    const fileName = `${recordingId}.webm`;
    const audioPath = `/recordings/${projectId}/${fileName}`;
    const filePath = path.join(recordingsDir, fileName);
    await writeFile(filePath, audioBuffer);

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
          const absolute = path.join(mediaRoot(), old.audioPath);
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
        const absolute = path.join(mediaRoot(), r.audioPath);
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
