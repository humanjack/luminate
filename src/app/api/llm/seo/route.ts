import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import {
  db,
  videoMetadata,
  researchData,
  scripts as scriptsTable,
  slides as slidesTable,
} from "@/lib/db";
import {
  SEO_SYSTEM_PROMPT,
  getSeoPrompt,
  parseSeoJson,
} from "@/lib/seo/prompt";
import { sanitizeSeoOutput } from "@/lib/seo/sanitize";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SeoBody {
  projectId: string;
  apiKey: string;
  model: string;
  targetAudience?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SeoBody;

  if (!body.projectId || !body.apiKey || !body.model) {
    return NextResponse.json(
      { error: "projectId, apiKey, and model are required" },
      { status: 400 }
    );
  }

  // Gather project context
  const [research] = await db
    .select()
    .from(researchData)
    .where(eq(researchData.projectId, body.projectId));
  const projectScripts = await db
    .select()
    .from(scriptsTable)
    .where(eq(scriptsTable.projectId, body.projectId));
  const projectSlides = await db
    .select()
    .from(slidesTable)
    .where(eq(slidesTable.projectId, body.projectId));
  projectSlides.sort((a, b) => a.index - b.index);
  projectScripts.sort((a, b) => a.slideIndex - b.slideIndex);

  if (projectSlides.length === 0 || projectScripts.length === 0) {
    return NextResponse.json(
      {
        error:
          "SEO generation needs slides and scripts. Run the upstream steps first.",
      },
      { status: 400 }
    );
  }

  const topic = research?.topic ?? "Untitled video";
  const researchSnippet = (research?.content ?? "").slice(0, 1500);
  const scriptSnippet = projectScripts
    .map((s) => s.text)
    .join("\n\n")
    .slice(0, 2000);

  const client = new Anthropic({ apiKey: body.apiKey });

  try {
    const response = await client.messages.create({
      model: body.model,
      max_tokens: 2048,
      system: SEO_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: getSeoPrompt({
            topic,
            researchSnippet,
            scriptSnippet,
            targetAudience: body.targetAudience,
          }),
        },
      ],
    });

    const text = response.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();

    let parsed: unknown;
    try {
      parsed = parseSeoJson(text);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Failed to parse LLM JSON output",
          detail: (err as Error).message,
          raw: text.slice(0, 1000),
        },
        { status: 502 }
      );
    }

    const sanitized = sanitizeSeoOutput(parsed, {
      slides: projectSlides,
      scripts: projectScripts,
    });

    // Persist (upsert)
    const now = new Date();
    const existing = await db
      .select()
      .from(videoMetadata)
      .where(eq(videoMetadata.projectId, body.projectId));

    let row;
    if (existing[0]) {
      [row] = await db
        .update(videoMetadata)
        .set({
          titles: sanitized.titles,
          description: sanitized.description,
          tags: sanitized.tags,
          selectedTitleIndex: 0,
          updatedAt: now,
        })
        .where(eq(videoMetadata.id, existing[0].id))
        .returning();
    } else {
      [row] = await db
        .insert(videoMetadata)
        .values({
          id: uuid(),
          projectId: body.projectId,
          titles: sanitized.titles,
          description: sanitized.description,
          tags: sanitized.tags,
          selectedTitleIndex: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    }

    return NextResponse.json(row);
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json(
      { error: "SEO generation failed", detail: message },
      { status: 502 }
    );
  }
}
