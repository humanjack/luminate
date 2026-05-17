import { describe, expect, it } from "vitest";
import { computeCost, formatCost, priceFor } from "@/lib/agent/cost";

describe("agent/cost", () => {
  it("returns Anthropic pricing for known model", () => {
    const price = priceFor("claude-sonnet-4-5-20250514");
    expect(price.inputPer1M).toBe(3);
    expect(price.outputPer1M).toBe(15);
  });

  it("falls back to a sensible default for unknown model", () => {
    const price = priceFor("totally-made-up-model");
    expect(price.inputPer1M).toBeGreaterThan(0);
    expect(price.outputPer1M).toBeGreaterThan(0);
  });

  it("computes cost in USD using per-1M-token rates", () => {
    // 1k input + 1k output on Sonnet 4.5 = 0.001*3 + 0.001*15 = $0.018
    const cost = computeCost("claude-sonnet-4-5-20250514", 1000, 1000);
    expect(cost).toBeCloseTo(0.018, 6);
  });

  it("computeCost handles zero tokens", () => {
    expect(computeCost("claude-sonnet-4-5-20250514", 0, 0)).toBe(0);
  });

  it("formats sub-cent prices as fraction of a cent", () => {
    expect(formatCost(0.005)).toBe("0.50¢");
  });

  it("formats sub-dollar prices with three decimals", () => {
    expect(formatCost(0.123)).toBe("$0.123");
  });

  it("formats dollar prices with two decimals", () => {
    expect(formatCost(1.234)).toBe("$1.23");
  });
});
