/**
 * In-process research generator seam (Phase 0, #44).
 *
 * Runtime decision (umbrella #43): research generation should run in-process in
 * Next.js — reusing the Anthropic SDK path used by `src/lib/agent/runner.ts` —
 * rather than proxying to the "frozen" FastAPI backend (see
 * `docs/runtime-boundary.md`). Phase 0 lands the seam and the feature gate; the
 * grounded generator itself is implemented in Phase 1 (#45).
 *
 * `useInProcessResearch()` is the gate `/api/llm/research` will consult: when
 * web research is enabled we run grounded generation here; otherwise we keep
 * the existing proxy/fallback path so nothing breaks mid-migration.
 */
import { getSearchProvider, SearchProvider, SearchProviderConfig } from "./search";

export type ResearchDepth = "quick" | "detailed" | "comprehensive";

/** Settings subset the research generator needs (decoupled from the store). */
export interface ResearchGenerationConfig {
  enableWebResearch: boolean;
  searchProvider: SearchProviderConfig["searchProvider"];
  maxSources: number;
  maxSearchIterations: number;
  anthropicApiKey?: string;
  tavilyApiKey?: string;
  braveApiKey?: string;
  /** Anthropic model id for generation. */
  model?: string;
}

/**
 * Whether the in-process grounded generator should handle a request. Phase 1
 * routes on this; Phase 0 callers can rely on it being `false` by default so
 * behavior is unchanged.
 */
export function useInProcessResearch(config: ResearchGenerationConfig): boolean {
  return Boolean(config.enableWebResearch);
}

/** Resolve the search-provider config slice from the generation config. */
export function resolveSearchProvider(
  config: ResearchGenerationConfig,
): SearchProvider {
  return getSearchProvider({
    searchProvider: config.searchProvider,
    anthropicApiKey: config.anthropicApiKey,
    tavilyApiKey: config.tavilyApiKey,
    braveApiKey: config.braveApiKey,
    maxSources: config.maxSources,
  });
}
