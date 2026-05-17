import { describe, expect, it } from "vitest";
import { AGENT_STEPS, nextStep, stepsBetween, stepIndex } from "@/lib/agent/types";

describe("agent/types", () => {
  it("declares the four pipeline steps in order", () => {
    expect(AGENT_STEPS).toEqual(["research", "content", "slides", "scripts"]);
  });

  it("nextStep walks forward and returns null past the end", () => {
    expect(nextStep("research")).toBe("content");
    expect(nextStep("content")).toBe("slides");
    expect(nextStep("slides")).toBe("scripts");
    expect(nextStep("scripts")).toBeNull();
  });

  it("stepIndex returns the position of each step", () => {
    expect(stepIndex("research")).toBe(0);
    expect(stepIndex("scripts")).toBe(3);
  });

  it("stepsBetween returns inclusive slices", () => {
    expect(stepsBetween("research", "scripts")).toEqual(AGENT_STEPS);
    expect(stepsBetween("content", "slides")).toEqual(["content", "slides"]);
  });

  it("stepsBetween returns [step] when from === to", () => {
    expect(stepsBetween("slides", "slides")).toEqual(["slides"]);
  });

  it("stepsBetween returns empty when range inverts", () => {
    expect(stepsBetween("scripts", "research")).toEqual([]);
  });
});
