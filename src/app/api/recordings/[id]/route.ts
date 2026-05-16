import { NextRequest, NextResponse } from "next/server";
import { db, recordings } from "@/lib/db";
import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import path from "path";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/recordings/[id] - Delete a single recording (and its audio file)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const [row] = await db.select().from(recordings).where(eq(recordings.id, id));
    if (!row) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }
    if (row.audioPath?.startsWith("/recordings/")) {
      const absolute = path.join(process.cwd(), "public", row.audioPath);
      await unlink(absolute).catch(() => undefined);
    }
    await db.delete(recordings).where(eq(recordings.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete recording:", error);
    return NextResponse.json(
      { error: "Failed to delete recording" },
      { status: 500 }
    );
  }
}

// GET /api/recordings/[id] - Get a single recording
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const [row] = await db.select().from(recordings).where(eq(recordings.id, id));
    if (!row) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (error) {
    console.error("Failed to load recording:", error);
    return NextResponse.json(
      { error: "Failed to load recording" },
      { status: 500 }
    );
  }
}
