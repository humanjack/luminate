import { NextRequest } from "next/server";
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
import { projectUpdateFields, ApiValidationError } from "@/lib/api/sanitize";
import { ok, fail, serverError } from "@/lib/api/respond";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Get a project with all related data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [project] = await db.select().from(projects).where(eq(projects.id, id));

    if (!project) {
      return fail("not_found", "Project not found", 404);
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

    return ok({
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
    return serverError(error, { message: "Failed to fetch project" });
  }
}

// PATCH /api/projects/[id] - Update a project
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Allow-list the writable columns — never trust a raw body spread, which
    // would let a client overwrite id/createdAt or set an out-of-enum status.
    const fields = projectUpdateFields(body);

    const [updated] = await db
      .update(projects)
      .set({
        ...fields,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return fail("not_found", "Project not found", 404);
    }

    return ok(updated);
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return fail("validation_error", error.message, 400);
    }
    return serverError(error, { message: "Failed to update project" });
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
      return fail("not_found", "Project not found", 404);
    }

    return ok({ success: true });
  } catch (error) {
    return serverError(error, { message: "Failed to delete project" });
  }
}
