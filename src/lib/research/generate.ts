/**
 * Research configuration and the grounded-search feature gate.
 * All generation runs in Next.js: grounded search uses the Anthropic research
 * pipeline; research without web search uses the selected LLM provider.
 */
import { getSearchProvider, SearchProvider, SearchProviderConfig, SearchResult } from "./search";

export type ResearchDepth = "quick" | "detailed" | "comprehensive";

/**
 * Events streamed by the grounded research generator. Mirrors the SSE contract
 * the client consumes via `useLLM`: text deltas, a one-time `sources` payload,
 * then done/error.
 */
export type ResearchEvent =
  | { type: "text"; content: string }
  | { type: "progress"; label: string }
  | { type: "sources"; sources: SearchResult[] }
  | { type: "done"; content?: string }
  | { type: "error"; content: string };

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

/** Whether grounded web research should handle this request. */
export function shouldUseInProcessResearch(config: ResearchGenerationConfig): boolean {
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
