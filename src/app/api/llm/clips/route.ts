import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import {
  db,
  researchData,
  scripts as scriptsTable,
  clipSuggestions,
} from "@/lib/db";
import { CLIPS_SYSTEM_PROMPT, getClipsPrompt, parseClipsJson } from "@/lib/clips/prompt";
import { sanitizeClips } from "@/lib/clips/sanitize";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ClipsBody {
  projectId: string;
  apiKey: string;
  model: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ClipsBody;

  if (!body.projectId || !body.apiKey || !body.model) {
    return NextResponse.json(
      { error: "projectId, apiKey and model are required" },
      { status: 400 }
    );
  }

  const [research] = await db
    .select()
    .from(researchData)
    .where(eq(researchData.projectId, body.projectId));

  const projectScripts = await db
    .select()
    .from(scriptsTable)
    .where(eq(scriptsTable.projectId, body.projectId));
  projectScripts.sort((a, b) => a.slideIndex - b.slideIndex);

  if (projectScripts.length === 0) {
    return NextResponse.json(
      { error: "Need scripts before suggesting clips. Run earlier steps first." },
      { status: 400 }
    );
  }

  let cursor = 0;
  const segments = projectScripts.map((s) => {
    const dur = s.estimatedDuration ?? 25;
    const seg = {
      index: s.slideIndex,
      text: s.text ?? "",
      startSec: cursor,
      endSec: cursor + dur,
    };
    cursor += dur;
    return seg;
  });
  const totalDurationSec = cursor;

  const client = new Anthropic({ apiKey: body.apiKey });

  try {
    const response = await client.messages.create({
      model: body.model,
      max_tokens: 1500,
      system: CLIPS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: getClipsPrompt(
            research?.topic ?? "Untitled",
            totalDurationSec,
            segments
          ),
        },
      ],
    });

    const text = response.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();

    let parsed: unknown;
    try {
      parsed = parseClipsJson(text);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Failed to parse LLM JSON",
          detail: (err as Error).message,
          raw: text.slice(0, 1000),
        },
        { status: 502 }
      );
    }

    const valid = sanitizeClips(parsed, totalDurationSec);

    // Replace previous suggestions atomically
    await db
      .delete(clipSuggestions)
      .where(eq(clipSuggestions.projectId, body.projectId));

    const now = new Date();
    const inserted = await Promise.all(
      valid.map((c) =>
        db
          .insert(clipSuggestions)
          .values({
            id: uuid(),
            projectId: body.projectId,
            startSec: c.startSec,
            endSec: c.endSec,
            hook: c.hook,
            viralityScore: c.viralityScore,
            reasoning: c.reasoning,
            status: "suggested",
            createdAt: now,
          })
          .returning()
      )
    );

    return NextResponse.json(inserted.map(([row]) => row));
  } catch (err) {
    return NextResponse.json(
      { error: "Clip suggestion failed", detail: (err as Error).message },
      { status: 502 }
    );
  }
}
