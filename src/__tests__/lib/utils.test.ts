import { describe, it, expect, vi } from "vitest";
import { cn, formatDuration, estimateReadingTime, generateId } from "@/lib/utils";

describe("cn (className utility)", () => {
  it("should merge multiple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", true && "included", false && "excluded")).toBe(
      "base included"
    );
  });

  it("should merge Tailwind classes correctly", () => {
    // Later classes should override earlier conflicting ones
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("should handle arrays of classes", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
  });

  it("should handle undefined and null values", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });

  it("should handle empty strings", () => {
    expect(cn("foo", "", "bar")).toBe("foo bar");
  });

  it("should handle object notation", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });
});

describe("formatDuration", () => {
  it("should format 0 seconds correctly", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("should format seconds under a minute", () => {
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(30)).toBe("0:30");
    expect(formatDuration(59)).toBe("0:59");
  });

  it("should format exact minutes", () => {
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(120)).toBe("2:00");
    expect(formatDuration(300)).toBe("5:00");
  });

  it("should format minutes and seconds", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(125)).toBe("2:05");
  });

  it("should handle large durations", () => {
    expect(formatDuration(3600)).toBe("60:00"); // 1 hour
    expect(formatDuration(3661)).toBe("61:01");
  });

  it("should floor decimal seconds", () => {
    expect(formatDuration(65.7)).toBe("1:05");
    expect(formatDuration(59.9)).toBe("0:59");
  });

  it("should pad single-digit seconds with zero", () => {
    expect(formatDuration(1)).toBe("0:01");
    expect(formatDuration(61)).toBe("1:01");
    expect(formatDuration(609)).toBe("10:09");
  });
});

describe("estimateReadingTime", () => {
  it("should handle empty string", () => {
    // Empty string splits to [""], which has length 1
    // 1 word at 150 WPM = 0.4 seconds, ceil to 1
    expect(estimateReadingTime("")).toBe(1);
  });

  it("should estimate reading time for short text", () => {
    // 150 words = 60 seconds at default 150 WPM
    const text = Array(150).fill("word").join(" ");
    expect(estimateReadingTime(text)).toBe(60);
  });

  it("should estimate reading time for longer text", () => {
    // 300 words = 120 seconds at 150 WPM
    const text = Array(300).fill("word").join(" ");
    expect(estimateReadingTime(text)).toBe(120);
  });

  it("should use custom words per minute", () => {
    // 100 words at 100 WPM = 60 seconds
    const text = Array(100).fill("word").join(" ");
    expect(estimateReadingTime(text, 100)).toBe(60);
  });

  it("should ceil to next second", () => {
    // 1 word at 150 WPM = 0.4 seconds, ceil to 1
    expect(estimateReadingTime("word")).toBe(1);
  });

  it("should handle text with multiple whitespace", () => {
    const text = "word1   word2\t\tword3\n\nword4";
    // Should count as 4 words
    const expectedSeconds = Math.ceil((4 / 150) * 60);
    expect(estimateReadingTime(text)).toBe(expectedSeconds);
  });

  it("should trim whitespace before counting", () => {
    const text = "   word1 word2 word3   ";
    const expectedSeconds = Math.ceil((3 / 150) * 60);
    expect(estimateReadingTime(text)).toBe(expectedSeconds);
  });

  it("should handle realistic paragraph", () => {
    const paragraph =
      "This is a test paragraph with approximately twenty words in it to test the reading time estimation function properly.";
    // 20 words at 150 WPM = 8 seconds
    const wordCount = paragraph.trim().split(/\s+/).length;
    const expectedSeconds = Math.ceil((wordCount / 150) * 60);
    expect(estimateReadingTime(paragraph)).toBe(expectedSeconds);
  });
});

describe("generateId", () => {
  it("should return a valid UUID format", () => {
    const id = generateId();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
  });

  it("should generate unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it("should return a string", () => {
    expect(typeof generateId()).toBe("string");
  });

  it("should have correct length (36 characters with hyphens)", () => {
    expect(generateId().length).toBe(36);
  });
});
