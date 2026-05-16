import { NextRequest, NextResponse } from "next/server";
import {
  db,
  projects,
  researchData,
  contentData,
  slides,
  scripts,
  recordings,
  analysisResults,
  videos,
  sources,
  claims,
  outlineItems,
} from "@/lib/db";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Get a project with all related data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [project] = await db.select().from(projects).where(eq(projects.id, id));

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch related data
    const [research] = await db.select().from(researchData).where(eq(researchData.projectId, id));
    const [content] = await db.select().from(contentData).where(eq(contentData.projectId, id));
    const projectSlides = await db.select().from(slides).where(eq(slides.projectId, id));
    const projectScripts = await db.select().from(scripts).where(eq(scripts.projectId, id));
    const projectRecordings = await db.select().from(recordings).where(eq(recordings.projectId, id));
    const projectAnalysis = await db.select().from(analysisResults).where(eq(analysisResults.projectId, id));
    const projectVideos = await db.select().from(videos).where(eq(videos.projectId, id));
    const projectSources = await db.select().from(sources).where(eq(sources.projectId, id));
    const projectClaims = await db.select().from(claims).where(eq(claims.projectId, id));
    const projectOutline = await db
      .select()
      .from(outlineItems)
      .where(eq(outlineItems.projectId, id));
    projectOutline.sort((a, b) => a.index - b.index);

    return NextResponse.json({
      ...project,
      researchData: research || null,
      contentData: content || null,
      slides: projectSlides,
      scripts: projectScripts,
      recordings: projectRecordings,
      analysisResults: projectAnalysis,
      videos: projectVideos,
      sources: projectSources,
      claims: projectClaims,
      outlineItems: projectOutline,
    });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

// PATCH /api/projects/[id] - Update a project
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const [updated] = await db
      .update(projects)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [deleted] = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
