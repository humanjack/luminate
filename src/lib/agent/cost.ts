// Per-1M-token prices in USD for the models we support.
// Kept here so we can budget runs and show a meter to the user.

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  "claude-sonnet-4-5-20250514": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-opus-4-7": { inputPer1M: 15.0, outputPer1M: 75.0 },
  "claude-haiku-4-5-20251001": { inputPer1M: 0.8, outputPer1M: 4.0 },
  // OpenAI
  "gpt-4.1": { inputPer1M: 2.0, outputPer1M: 8.0 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  // Google
  "gemini-2.5-flash": { inputPer1M: 0.3, outputPer1M: 2.5 },
};

const FALLBACK: ModelPricing = { inputPer1M: 3.0, outputPer1M: 15.0 };

export function priceFor(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? FALLBACK;
}

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const price = priceFor(model);
  const cost =
    (inputTokens / 1_000_000) * price.inputPer1M +
    (outputTokens / 1_000_000) * price.outputPer1M;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(2)}¢`.replace("$", "");
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
