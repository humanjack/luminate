import { describe, it, expect } from "vitest";
import {
  projectUpdateFields,
  researchUpdateFields,
  contentUpdateFields,
  ApiValidationError,
} from "@/lib/api/sanitize";

describe("projectUpdateFields", () => {
  it("strips non-allow-listed columns (id, createdAt, projectId, arbitrary)", () => {
    const out = projectUpdateFields({
      id: "evil",
      createdAt: 0,
      projectId: "other",
      updatedAt: 12345,
      name: "Kept",
      bogusColumn: "x",
    });
    expect(out).toEqual({ name: "Kept" });
    expect(out).not.toHaveProperty("id");
    expect(out).not.toHaveProperty("createdAt");
    expect(out).not.toHaveProperty("projectId");
  });

  it("accepts valid name/currentStep/status and trims name", () => {
    expect(projectUpdateFields({ name: "  Hi  " })).toEqual({ name: "Hi" });
    expect(projectUpdateFields({ currentStep: 5 })).toEqual({ currentStep: 5 });
    expect(projectUpdateFields({ status: "completed" })).toEqual({ status: "completed" });
  });

  it("rejects an out-of-enum status", () => {
    expect(() => projectUpdateFields({ status: "bogus" })).toThrow(ApiValidationError);
  });

  it("rejects an empty name and out-of-range currentStep", () => {
    expect(() => projectUpdateFields({ name: "   " })).toThrow(ApiValidationError);
    expect(() => projectUpdateFields({ currentStep: 0 })).toThrow(ApiValidationError);
    expect(() => projectUpdateFields({ currentStep: 8 })).toThrow(ApiValidationError);
    expect(() => projectUpdateFields({ currentStep: 2.5 })).toThrow(ApiValidationError);
  });

  it("returns an empty object for a null/array/primitive body", () => {
    expect(projectUpdateFields(null)).toEqual({});
    expect(projectUpdateFields([1, 2])).toEqual({});
    expect(projectUpdateFields("nope")).toEqual({});
  });
});

describe("researchUpdateFields", () => {
  it("allow-lists topic/depth/content/sources and drops the rest", () => {
    const out = researchUpdateFields({
      id: "evil",
      topic: "AI",
      depth: "comprehensive",
      content: "body",
      sources: [{ title: "t", url: "u" }],
      projectId: "x",
    });
    expect(out).toEqual({
      topic: "AI",
      depth: "comprehensive",
      content: "body",
      sources: [{ title: "t", url: "u" }],
    });
  });

  it("rejects an invalid depth and a non-array sources", () => {
    expect(() => researchUpdateFields({ depth: "deep" })).toThrow(ApiValidationError);
    expect(() => researchUpdateFields({ sources: "not-array" })).toThrow(ApiValidationError);
  });

  it("accepts null sources", () => {
    expect(researchUpdateFields({ sources: null })).toEqual({ sources: null });
  });
});

describe("contentUpdateFields", () => {
  it("allow-lists title/format/targetLength/outline/markdown", () => {
    const out = contentUpdateFields({
      id: "evil",
      title: "T",
      format: "tutorial",
      targetLength: 12,
      outline: [{ title: "s", points: ["p"] }],
      markdown: "# md",
    });
    expect(out).toEqual({
      title: "T",
      format: "tutorial",
      targetLength: 12,
      outline: [{ title: "s", points: ["p"] }],
      markdown: "# md",
    });
  });

  it("rejects an invalid format and out-of-range targetLength", () => {
    expect(() => contentUpdateFields({ format: "movie" })).toThrow(ApiValidationError);
    expect(() => contentUpdateFields({ targetLength: 0 })).toThrow(ApiValidationError);
    expect(() => contentUpdateFields({ targetLength: 9999 })).toThrow(ApiValidationError);
  });
});
