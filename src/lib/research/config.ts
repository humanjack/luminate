/**
 * Load the research-generation config from the settings table (Phase 1, #45).
 *
 * Server-only (reads the DB). The settings table stores values as strings:
 * plain strings for keys/ids (stored raw), and JSON for booleans/numbers
 * (stored via JSON.stringify). We coerce defensively so a malformed/legacy
 * value never throws — it just falls back to a default.
 */
import { db, settings } from "@/lib/db";

import { ResearchGenerationConfig } from "./generate";
import { SearchProviderId } from "./search";

const SEARCH_PROVIDERS: SearchProviderId[] = ["anthropic", "tavily", "brave"];

function coerceBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  try {
    return Boolean(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

function coerceNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Strip JSON quoting if a string value was stored via JSON.stringify. */
function coerceString(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      return String(JSON.parse(raw));
    } catch {
      return raw;
    }
  }
  return raw;
}

export async function loadResearchGenerationConfig(): Promise<ResearchGenerationConfig> {
  const rows = await db.select().from(settings);
  const map = new Map<string, string>();
  for (const row of rows) map.set(row.key, row.value ?? "");

  const providerRaw = coerceString(map.get("searchProvider"));
  const searchProvider = SEARCH_PROVIDERS.includes(providerRaw as SearchProviderId)
    ? (providerRaw as SearchProviderId)
    : "anthropic";

  return {
    enableWebResearch: coerceBool(map.get("enableWebResearch"), false),
    searchProvider,
    maxSources: coerceNumber(map.get("maxSources"), 8),
    maxSearchIterations: coerceNumber(map.get("maxSearchIterations"), 2),
    anthropicApiKey: coerceString(map.get("anthropicApiKey")) || undefined,
    tavilyApiKey: coerceString(map.get("tavilyApiKey")) || undefined,
    braveApiKey: coerceString(map.get("braveApiKey")) || undefined,
    model: coerceString(map.get("claudeModel")) || undefined,
  };
}
