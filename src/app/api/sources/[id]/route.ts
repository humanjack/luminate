import { NextRequest, NextResponse } from "next/server";
import { db, sources } from "@/lib/db";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/sources/[id] - Update a source (status, trust notes, etc.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();
  const allowed = [
    "title",
    "author",
    "publishedAt",
    "fetchedText",
    "status",
    "trustNotes",
  ] as const;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }
  const [updated] = await db
    .update(sources)
    .set(patch)
    .where(eq(sources.id, id))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

// DELETE /api/sources/[id] - Delete a source
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  await db.delete(sources).where(eq(sources.id, id));
  return NextResponse.json({ success: true });
}
