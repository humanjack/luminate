/**
 * Tavily search provider (search-api mode).
 *
 * Phase 0: scaffold. The factory only constructs this when a Tavily API key is
 * present (see `./index`). The actual HTTP call to Tavily's search endpoint is
 * implemented in Phase 1 (#45). Provider-agnostic so the generator can inject
 * results regardless of the underlying LLM provider.
 */
import {
  SearchOptions,
  SearchProvider,
  SearchProviderNotImplementedError,
  SearchResult,
} from "./types";

export class TavilySearchProvider implements SearchProvider {
  readonly id = "tavily" as const;
  readonly mode = "search-api" as const;

  constructor(private readonly apiKey: string) {}

  async search(_query: string, _opts?: SearchOptions): Promise<SearchResult[]> {
    void this.apiKey;
    // Phase 1 (#45): POST https://api.tavily.com/search with this.apiKey,
    // map { title, url, content } → SearchResult[].
    throw new SearchProviderNotImplementedError("tavily", "search()");
  }

  getToolDefinitions(): unknown[] {
    return [];
  }
}
