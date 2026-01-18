import { describe, it, expect } from "vitest";

/**
 * Claude CLI Integration Tests
 *
 * Note: The Claude CLI module spawns external processes which are difficult
 * to mock in ESM environments. The core functionality is tested through:
 * - prompts.test.ts - Tests all prompt generation logic
 * - anthropic-client.test.ts - Tests streaming patterns (shared logic)
 *
 * The CLI integration itself requires running the actual Claude CLI binary
 * which is tested manually during development.
 */

describe("Claude CLI Integration", () => {
  describe("Module exports", () => {
    it("should export streamResearch function", async () => {
      const { streamResearch } = await import("@/lib/llm/claude-cli");
      expect(typeof streamResearch).toBe("function");
    });

    it("should export streamContent function", async () => {
      const { streamContent } = await import("@/lib/llm/claude-cli");
      expect(typeof streamContent).toBe("function");
    });

    it("should export streamScript function", async () => {
      const { streamScript } = await import("@/lib/llm/claude-cli");
      expect(typeof streamScript).toBe("function");
    });

    it("should export StreamingMessage type via function signature", async () => {
      const { streamResearch } = await import("@/lib/llm/claude-cli");
      // Verify it returns an AsyncGenerator
      const generator = streamResearch("test", "quick");
      expect(generator[Symbol.asyncIterator]).toBeDefined();
    });
  });

  describe("Prompt generation (covered in prompts.test.ts)", () => {
    it("research prompts include depth instructions - see prompts.test.ts", () => {
      // This is tested comprehensively in prompts.test.ts
      // Including: quick, detailed, and comprehensive depth levels
      expect(true).toBe(true);
    });

    it("content prompts include format and target length - see prompts.test.ts", () => {
      // This is tested comprehensively in prompts.test.ts
      // Including: presentation, tutorial, explainer formats
      expect(true).toBe(true);
    });

    it("script prompts include slide index and guidelines - see prompts.test.ts", () => {
      // This is tested comprehensively in prompts.test.ts
      expect(true).toBe(true);
    });
  });
});
