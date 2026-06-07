/**
 * Brave Search provider (search-api mode).
 *
 * Phase 0: scaffold. The factory only constructs this when a Brave API key is
 * present (see `./index`). The actual HTTP call to the Brave Search API is
 * implemented in Phase 1 (#45).
 */
import {
  SearchOptions,
  SearchProvider,
  SearchProviderNotImplementedError,
  SearchResult,
} from "./types";

export class BraveSearchProvider implements SearchProvider {
  readonly id = "brave" as const;
  readonly mode = "search-api" as const;

  constructor(private readonly apiKey: string) {}

  async search(_query: string, _opts?: SearchOptions): Promise<SearchResult[]> {
    void this.apiKey;
    // Phase 1 (#45): GET https://api.search.brave.com/res/v1/web/search
    // with X-Subscription-Token: this.apiKey, map results → SearchResult[].
    throw new SearchProviderNotImplementedError("brave", "search()");
  }

  getToolDefinitions(): unknown[] {
    return [];
  }

  // search-api providers surface sources via search(), not message parsing.
  extractSources(): SearchResult[] {
    return [];
  }
}
