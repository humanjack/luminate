import { describe, expect, it } from "vitest";
import { buildTimestamps } from "@/lib/seo/timestamps";

describe("seo/timestamps", () => {
  it("anchors first chapter at 0:00 and offsets by script durations", () => {
    const lines = buildTimestamps(
      [
        { index: 0, markdown: "# Intro\n" },
        { index: 1, markdown: "# Why now\n" },
        { index: 2, markdown: "# Closing\n" },
      ],
      [
        { slideIndex: 0, estimatedDuration: 30 },
        { slideIndex: 1, estimatedDuration: 45 },
        { slideIndex: 2, estimatedDuration: 20 },
      ]
    );
    expect(lines).toEqual([
      "0:00 Intro",
      "0:30 Why now",
      "1:15 Closing",
    ]);
  });

  it("falls back to a 30-second default when a script is missing", () => {
    const lines = buildTimestamps(
      [
        { index: 0, markdown: "# A\n" },
        { index: 1, markdown: "# B\n" },
      ],
      []
    );
    expect(lines[0]).toBe("0:00 A");
    expect(lines[1]).toBe("0:30 B");
  });

  it("uses 'Slide N' when no heading is present", () => {
    const lines = buildTimestamps(
      [{ index: 4, markdown: "some content with no heading" }],
      [{ slideIndex: 4, estimatedDuration: 10 }]
    );
    expect(lines).toEqual(["0:00 Slide 5"]);
  });

  it("returns [] when there are no slides", () => {
    expect(buildTimestamps([], [])).toEqual([]);
  });
});
