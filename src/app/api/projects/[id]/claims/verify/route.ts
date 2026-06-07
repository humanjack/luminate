import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";

import { db, claims, sources } from "@/lib/db";
import { loadResearchGenerationConfig } from "@/lib/research/config";
import {
  ClaimToVerify,
  partitionVerifiable,
  summarizeTrust,
  Verdict,
  verifyClaims,
} from "@/lib/research/verify";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/projects/[id]/claims/verify — citation grounding pass (Phase 3, #47).
 *
 * Checks each claim against the text of its cited source(s) and returns a trust
 * report (per-claim verdicts + summary). Does not mutate claims (see verify.ts
 * note on deferred persistence).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    const [claimRows, sourceRows] = await Promise.all([
      db.select().from(claims).where(eq(claims.projectId, projectId)),
      db.select().from(sources).where(eq(sources.projectId, projectId)),
    ]);

    if (claimRows.length === 0) {
      return NextResponse.json({
        verdicts: [],
        summary: { total: 0, supported: 0, unsupported: 0, unverifiable: 0, groundedRatio: 0 },
      });
    }

    const sourceById = new Map(sourceRows.map((s) => [s.id, s]));

    const toVerify: ClaimToVerify[] = claimRows.map((c) => ({
      id: c.id,
      text: c.text,
      sources: (c.sourceIds ?? [])
        .map((sid) => sourceById.get(sid))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => ({ url: s.url, title: s.title, text: s.fetchedText ?? "" })),
    }));

    const { verifiable, unverifiable } = partitionVerifiable(toVerify);

    let verdicts: Verdict[] = [];
    if (verifiable.length > 0) {
      const config = await loadResearchGenerationConfig();
      if (!config.anthropicApiKey) {
        return NextResponse.json(
          { error: "Verification needs an Anthropic API key (Settings → API Keys)." },
          { status: 400 },
        );
      }
      const client = new Anthropic({ apiKey: config.anthropicApiKey });
      verdicts = await verifyClaims(client, config.model || "claude-sonnet-4-6", verifiable);
    }

    // Claims the LLM didn't return a verdict for default to unsupported (it had
    // source text but the judge didn't confirm support).
    const judged = new Set(verdicts.map((v) => v.claimId));
    for (const c of verifiable) {
      if (!judged.has(c.id)) verdicts.push({ claimId: c.id, status: "unsupported" });
    }
    for (const c of unverifiable) {
      verdicts.push({ claimId: c.id, status: "unverifiable" });
    }

    const summary = summarizeTrust(
      verdicts.filter((v) => v.status !== "unverifiable"),
      unverifiable.length,
    );

    return NextResponse.json({ verdicts, summary });
  } catch (error) {
    console.error("Failed to verify claims:", error);
    return NextResponse.json({ error: "Failed to verify claims" }, { status: 500 });
  }
}
