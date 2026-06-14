import { NextRequest } from "next/server";
import { db, recordings } from "@/lib/db";
import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import path from "path";
import { ok, fail, serverError } from "@/lib/api/respond";
import { mediaRoot } from "@/lib/paths";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/recordings/[id] - Delete a single recording (and its audio file)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const [row] = await db.select().from(recordings).where(eq(recordings.id, id));
    if (!row) {
      return fail("not_found", "Recording not found", 404);
    }
    if (row.audioPath?.startsWith("/recordings/")) {
      const absolute = path.join(mediaRoot(), row.audioPath);
      await unlink(absolute).catch(() => undefined);
    }
    await db.delete(recordings).where(eq(recordings.id, id));
    return ok({ success: true });
  } catch (error) {
    return serverError(error, { message: "Failed to delete recording" });
  }
}

// GET /api/recordings/[id] - Get a single recording
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const [row] = await db.select().from(recordings).where(eq(recordings.id, id));
    if (!row) {
      return fail("not_found", "Recording not found", 404);
    }
    return ok(row);
  } catch (error) {
    return serverError(error, { message: "Failed to load recording" });
  }
}
