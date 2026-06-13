/**
 * Anthropic native web search provider (default).
 *
 * Phase 0: this is a scaffold. It declares the server-side web-search tool that
 * the research generator will attach to its `messages.create` call in Phase 1
 * (#45), but does not itself perform generation. Because Anthropic's web search
 * runs as a tool *inside* the model call, there is no standalone `search()`
 * step — callers attach `getToolDefinitions()` to the generation request and
 * parse `web_search_tool_result` citations from the response.
 *
 * Tool version: `web_search_20260209` — typed by the installed SDK (≥0.102)
 * and supports dynamic filtering on Opus 4.8/4.7/4.6 + Sonnet 4.6. No extra
 * API key is needed beyond the configured Anthropic key.
 */
import {
  SearchProvider,
  SearchProviderNotImplementedError,
  SearchResult,
} from "./types";

export const ANTHROPIC_WEB_SEARCH_TYPE = "web_search_20260209" as const;

export class AnthropicSearchProvider implements SearchProvider {
  readonly id = "anthropic" as const;
  readonly mode = "native-tool" as const;

  constructor(
    /** Max results hint passed to the web_search tool in Phase 1. */
    private readonly maxResults: number = 8,
  ) {}

  // Native-tool providers don't expose a standalone search step.
  async search(): Promise<SearchResult[]> {
    throw new SearchProviderNotImplementedError("anthropic", "standalone search()");
  }

  getToolDefinitions(): unknown[] {
    // Phase 1 (#45) fills this in against the pinned SDK's tool typings,
    // selecting the preferred tool version when available.
    return [
      {
        type: ANTHROPIC_WEB_SEARCH_TYPE,
        name: "web_search",
        max_uses: this.maxResults,
      },
    ];
  }
}
