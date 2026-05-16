import { NextRequest, NextResponse } from "next/server";
import { db, sources } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/sources - List sources for a project
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params;
  const rows = await db
    .select()
    .from(sources)
    .where(eq(sources.projectId, projectId));
  return NextResponse.json(rows);
}

// POST /api/projects/[id]/sources - Add a source
// body: { type: 'url' | 'text' | 'manual', url?, title?, fetchedText?, author?, publishedAt? }
//
// For `url` sources we also attempt a quick fetch and stash the resulting
// text on the row. Network failure does not fail the request — the source
// is still created with status `failed` so the user can keep working.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const type: "url" | "text" | "manual" = body.type;
    if (!["url", "text", "manual"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'url', 'text', or 'manual'" },
        { status: 400 }
      );
    }
    if (type === "url" && !body.url) {
      return NextResponse.json(
        { error: "url is required for type=url" },
        { status: 400 }
      );
    }
    if (type === "text" && !body.fetchedText) {
      return NextResponse.json(
        { error: "fetchedText is required for type=text" },
        { status: 400 }
      );
    }

    let status: "pending" | "fetched" | "failed" = "pending";
    let fetchedText: string | null = body.fetchedText ?? null;
    let title: string | null = body.title ?? null;

    if (type === "url") {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(body.url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        fetchedText = stripHtml(html).slice(0, 200_000);
        title = title || extractTitle(html) || body.url;
        status = "fetched";
      } catch (err) {
        console.warn("Source fetch failed:", err);
        status = "failed";
      }
    } else if (type === "text") {
      status = "fetched";
      title = title || (fetchedText ?? "").split("\n")[0]?.slice(0, 80) || "Pasted source";
    }

    const now = new Date();
    const [created] = await db
      .insert(sources)
      .values({
        id: uuid(),
        projectId,
        type,
        url: body.url ?? null,
        title,
        author: body.author ?? null,
        publishedAt: body.publishedAt ?? null,
        fetchedText,
        status,
        trustNotes: body.trustNotes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to add source:", error);
    return NextResponse.json(
      { error: "Failed to add source" },
      { status: 500 }
    );
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}
