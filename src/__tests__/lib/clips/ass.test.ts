import { describe, expect, it } from "vitest";
import { buildAssFromWords, evenlySpacedWords } from "@/lib/clips/ass";
import { parseClipsJson } from "@/lib/clips/prompt";

describe("clips/ass", () => {
  it("includes the ASS header and one Dialogue line per word", () => {
    const ass = buildAssFromWords([
      { text: "hello", startSec: 0, endSec: 0.5 },
      { text: "world", startSec: 0.5, endSec: 1.0 },
    ]);
    expect(ass).toContain("[Script Info]");
    expect(ass).toContain("[V4+ Styles]");
    expect(ass).toContain("[Events]");
    expect(ass.match(/^Dialogue:/gm)?.length).toBe(2);
  });

  it("escapes the curly braces that would otherwise be ASS overrides", () => {
    const ass = buildAssFromWords([{ text: "{evil}", startSec: 0, endSec: 1 }]);
    expect(ass).not.toContain("{evil}");
    expect(ass).toContain("(evil)");
  });

  it("evenlySpacedWords carves the duration into N cues", () => {
    const cues = evenlySpacedWords("one two three four", 10, 14);
    expect(cues.length).toBe(4);
    expect(cues[0].startSec).toBeCloseTo(10, 6);
    expect(cues[cues.length - 1].endSec).toBeGreaterThan(13.9);
  });

  it("evenlySpacedWords returns [] when empty or zero-duration", () => {
    expect(evenlySpacedWords("", 0, 10)).toEqual([]);
    expect(evenlySpacedWords("hi", 10, 10)).toEqual([]);
  });
});

describe("clips/prompt parseClipsJson", () => {
  it("parses plain JSON arrays", () => {
    expect(parseClipsJson('[{"x":1}]')).toEqual([{ x: 1 }]);
  });

  it("strips ```json fences", () => {
    expect(parseClipsJson('```json\n[1,2,3]\n```')).toEqual([1, 2, 3]);
  });

  it("throws on garbage", () => {
    expect(() => parseClipsJson("nope")).toThrow();
  });
});
