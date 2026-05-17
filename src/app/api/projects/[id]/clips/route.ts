import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, clipSuggestions } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(clipSuggestions)
    .where(eq(clipSuggestions.projectId, id));
  rows.sort((a, b) => b.viralityScore - a.viralityScore);
  return NextResponse.json(rows);
}

// PATCH /api/projects/:id/clips — flip a suggestion's status
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = (await req.json()) as {
    clipId?: string;
    status?: "suggested" | "kept" | "discarded";
  };
  if (!body.clipId || !body.status) {
    return NextResponse.json(
      { error: "clipId and status required" },
      { status: 400 }
    );
  }
  await db
    .update(clipSuggestions)
    .set({ status: body.status })
    .where(and(eq(clipSuggestions.projectId, id), eq(clipSuggestions.id, body.clipId)));
  const updated = await db
    .select()
    .from(clipSuggestions)
    .where(eq(clipSuggestions.projectId, id));
  updated.sort((a, b) => b.viralityScore - a.viralityScore);
  return NextResponse.json(updated);
}
