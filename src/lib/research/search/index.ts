/**
 * Search-provider factory (Phase 0, #44).
 *
 * `getSearchProvider(config)` returns the configured provider, validating that
 * key-required providers have their key. The Anthropic provider is the default
 * and needs no extra key beyond the configured Anthropic API key (its web
 * search rides on the generation call).
 */
import { AnthropicSearchProvider } from "./anthropic";
import { BraveSearchProvider } from "./brave";
import { TavilySearchProvider } from "./tavily";
import {
  MissingSearchKeyError,
  SearchProvider,
  SearchProviderConfig,
} from "./types";

export * from "./types";
export { AnthropicSearchProvider } from "./anthropic";
export { TavilySearchProvider } from "./tavily";
export { BraveSearchProvider } from "./brave";

export function getSearchProvider(config: SearchProviderConfig): SearchProvider {
  switch (config.searchProvider) {
    case "anthropic":
      return new AnthropicSearchProvider(config.maxSources);

    case "tavily":
      if (!config.tavilyApiKey) throw new MissingSearchKeyError("tavily");
      return new TavilySearchProvider(config.tavilyApiKey);

    case "brave":
      if (!config.braveApiKey) throw new MissingSearchKeyError("brave");
      return new BraveSearchProvider(config.braveApiKey);

    default: {
      // Exhaustiveness guard — a new SearchProviderId must be handled here.
      const unknown: never = config.searchProvider;
      throw new Error(`Unknown search provider: ${String(unknown)}`);
    }
  }
}
