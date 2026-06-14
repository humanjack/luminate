import Anthropic from "@anthropic-ai/sdk";

export interface AnthropicClientOptions {
  /** Per-request timeout (ms). Default 120s — long enough for big generations. */
  timeout?: number;
  /** SDK-level retries on transient errors (429/5xx/network). Default 2. */
  maxRetries?: number;
}

/**
 * Single place to construct the Anthropic SDK client so every caller gets a
 * bounded timeout + retries. Previously each of the six call sites did
 * `new Anthropic({ apiKey })` with the SDK defaults (which include no overall
 * deadline beyond per-attempt), so a stuck request could hold a server
 * connection for the full route maxDuration.
 */
export function createAnthropicClient(
  apiKey: string,
  opts: AnthropicClientOptions = {}
): Anthropic {
  return new Anthropic({
    apiKey,
    timeout: opts.timeout ?? 120_000,
    maxRetries: opts.maxRetries ?? 2,
  });
}
