/**
 * Citation grounding / verification (Phase 3, #47).
 *
 * A dedicated post-hoc pass that checks each claim is actually supported by the
 * text of its cited source(s) — the single biggest lever for citation accuracy
 * (frontier deep-research systems hit only ~39-77% factual accuracy even with
 * valid links). Decoupling "find info" from "verify attribution" catches
 * plausible-but-misattributed citations.
 *
 * The LLM judge lives in `verifyClaims`; the prompt building, verdict parsing,
 * and trust aggregation are pure and unit-tested.
 *
 * Note (Phase 3 v1): verdicts are returned to the client as a trust report and
 * not persisted to new claim columns — `drizzle-kit generate` is broken under
 * this repo's Node/ESM tooling, so adding `verification_status`/`evidence`
 * columns + migration is a follow-up. Verification runs on demand.
 */
import type Anthropic from "@anthropic-ai/sdk";

export interface ClaimSourceExcerpt {
  url: string | null;
  title: string | null;
  text: string;
}

export interface ClaimToVerify {
  id: string;
  text: string;
  sources: ClaimSourceExcerpt[];
}

export interface Verdict {
  claimId: string;
  /** "supported": cited source backs the claim; "unsupported": it doesn't;
   *  "unverifiable": no usable cited source text to check against. */
  status: "supported" | "unsupported" | "unverifiable";
  evidence?: string;
}

export interface TrustSummary {
  total: number;
  supported: number;
  unsupported: number;
  unverifiable: number;
  /** supported / total, 0..1 (0 when there are no claims). */
  groundedRatio: number;
}

const MAX_SOURCE_CHARS = 2000;

/** Claims with at least one source carrying usable text can be judged by the LLM. */
export function partitionVerifiable(claims: ClaimToVerify[]): {
  verifiable: ClaimToVerify[];
  unverifiable: ClaimToVerify[];
} {
  const verifiable: ClaimToVerify[] = [];
  const unverifiable: ClaimToVerify[] = [];
  for (const c of claims) {
    const hasText = c.sources.some((s) => s.text && s.text.trim().length > 0);
    (hasText ? verifiable : unverifiable).push(c);
  }
  return { verifiable, unverifiable };
}

export function buildVerificationPrompt(claims: ClaimToVerify[]): string {
  const blocks = claims
    .map((c, i) => {
      const srcs = c.sources
        .map(
          (s, j) =>
            `  Source ${j + 1} (${s.url ?? "n/a"}):\n  """${s.text.slice(0, MAX_SOURCE_CHARS)}"""`,
        )
        .join("\n");
      return `Claim ${i + 1} [id=${c.id}]: ${c.text}\n${srcs}`;
    })
    .join("\n\n");

  return `You are a fact-checking judge. For each claim below, decide whether the provided source text(s) actually SUPPORT the claim.

- "supported": the source text directly backs the claim.
- "unsupported": the source text does not back the claim, or contradicts it.
When supported, include a short verbatim "evidence" quote from the source.

${blocks}

Respond with ONLY a JSON array, one object per claim, no prose, no code fence:
[{"claimId": "<id>", "status": "supported" | "unsupported", "evidence": "<quote or empty>"}]`;
}

/** Tolerant parse of the judge's JSON array; only keeps verdicts for known ids. */
export function parseVerdicts(text: string, validIds: Set<string>): Verdict[] {
  if (!text) return [];
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  const candidate = start !== -1 && end > start ? text.slice(start, end + 1) : text;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const verdicts: Verdict[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const claimId = typeof obj.claimId === "string" ? obj.claimId : undefined;
    if (!claimId || !validIds.has(claimId)) continue;
    const status = obj.status === "supported" ? "supported" : "unsupported";
    const evidence = typeof obj.evidence === "string" && obj.evidence.trim() ? obj.evidence.trim() : undefined;
    verdicts.push({ claimId, status, evidence });
  }
  return verdicts;
}

/** Aggregate verdicts (verifiable) + unverifiable claims into a trust summary. */
export function summarizeTrust(verdicts: Verdict[], unverifiableCount: number): TrustSummary {
  const supported = verdicts.filter((v) => v.status === "supported").length;
  const unsupported = verdicts.filter((v) => v.status === "unsupported").length;
  const total = supported + unsupported + unverifiableCount;
  return {
    total,
    supported,
    unsupported,
    unverifiable: unverifiableCount,
    groundedRatio: total === 0 ? 0 : supported / total,
  };
}

export async function verifyClaims(
  client: Anthropic,
  model: string,
  claims: ClaimToVerify[],
): Promise<Verdict[]> {
  if (claims.length === 0) return [];
  const validIds = new Set(claims.map((c) => c.id));
  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: buildVerificationPrompt(claims) }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseVerdicts(text, validIds);
}
