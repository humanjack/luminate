/**
 * Search-provider abstraction (Phase 0, umbrella #43 / #44).
 *
 * This module is intentionally DEPENDENCY-FREE (pure types + a small error
 * class) so it can be imported from both the client (settings store) and the
 * server (research generator) without pulling in the Anthropic SDK or `fetch`
 * polyfills. Concrete providers live in sibling files and are wired up by
 * `getSearchProvider()` in `./index`.
 *
 * Two provider shapes exist because grounding works differently per provider:
 *   - "native-tool": the LLM invokes web search as an Anthropic server-side
 *     tool *during* generation. There is no standalone query step — the
 *     provider supplies tool definitions and parses citations from the result.
 *   - "search-api": a standalone search API (Tavily, Brave) queried by us
 *     before/around generation; results are fetched and injected into context.
 */

export type SearchProviderId = "anthropic" | "tavily" | "brave";

export type SearchProviderMode = "native-tool" | "search-api";

export interface SearchResult {
  title: string;
  url: string;
  /** Short snippet/summary from the search index, if available. */
  snippet?: string;
  /** Full fetched page text, if the provider returns it. */
  content?: string;
}

export interface SearchOptions {
  /** Max results to return for this query. */
  maxResults?: number;
  signal?: AbortSignal;
}

export interface SearchProvider {
  readonly id: SearchProviderId;
  readonly mode: SearchProviderMode;

  /**
   * Standalone search. Implemented by "search-api" providers (Tavily/Brave).
   * "native-tool" providers (Anthropic) throw — use `getToolDefinitions()`.
   */
  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Anthropic SDK tool definitions to attach to a `messages.create` call.
   * Implemented by "native-tool" providers; "search-api" providers return [].
   */
  getToolDefinitions(): unknown[];

  /**
   * Parse real sources from a completed model message (native-tool providers,
   * which surface sources via the web-search result/citation blocks).
   * "search-api" providers return [] (their sources come from `search()`).
   */
  extractSources(messageContent: unknown): SearchResult[];
}

/** Narrow config the factory needs — decoupled from the full settings store. */
export interface SearchProviderConfig {
  searchProvider: SearchProviderId;
  /** Used only to validate that the host has an Anthropic key for native search. */
  anthropicApiKey?: string;
  tavilyApiKey?: string;
  braveApiKey?: string;
  maxSources?: number;
}

/** Thrown when a key-required provider is selected without its API key. */
export class MissingSearchKeyError extends Error {
  constructor(public readonly provider: SearchProviderId) {
    super(
      `Search provider "${provider}" requires an API key. ` +
        `Add it in Settings → Research, or switch to the Anthropic provider.`,
    );
    this.name = "MissingSearchKeyError";
  }
}

/** Thrown when a provider capability is selected in Phase 0 before it's wired up. */
export class SearchProviderNotImplementedError extends Error {
  constructor(provider: SearchProviderId, capability: string) {
    super(
      `Search provider "${provider}" does not implement ${capability} yet ` +
        `(lands in Phase 1, #45).`,
    );
    this.name = "SearchProviderNotImplementedError";
  }
}
