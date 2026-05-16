import { describe, it, expect } from "vitest";
import {
  buildSegments,
  toVtt,
  toSrt,
  toTranscript,
  toSourceList,
} from "@/lib/export/captions";

const slideA = { index: 0, markdown: "# First slide\n- bullet" };
const slideB = { index: 1, markdown: "# Second slide" };

describe("buildSegments", () => {
  it("accumulates start/end from recording durations", () => {
    const segs = buildSegments([
      { slide: slideA, script: { text: "Welcome." }, recording: { duration: 10 } },
      { slide: slideB, script: { text: "Body." }, recording: { duration: 7.5 } },
    ]);
    expect(segs.length).toBe(2);
    expect(segs[0].start).toBe(0);
    expect(segs[0].end).toBe(10);
    expect(segs[1].start).toBe(10);
    expect(segs[1].end).toBe(17.5);
    expect(segs[0].text).toBe("Welcome.");
  });

  it("falls back to slide title when script is missing", () => {
    const segs = buildSegments([
      { slide: slideA, script: undefined, recording: { duration: 4 } },
    ]);
    expect(segs[0].text).toBe("First slide");
  });

  it("skips slides without a duration", () => {
    const segs = buildSegments([
      { slide: slideA, script: { text: "x" }, recording: undefined },
      { slide: slideB, script: { text: "y" }, recording: { duration: 5 } },
    ]);
    expect(segs.length).toBe(1);
    expect(segs[0].text).toBe("y");
  });
});

describe("toVtt", () => {
  it("emits a WEBVTT header and HH:MM:SS.mmm timestamps", () => {
    const vtt = toVtt([{ start: 0, end: 1.5, text: "Hello" }]);
    expect(vtt.startsWith("WEBVTT\n")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.500");
    expect(vtt).toContain("Hello");
  });

  it("escapes < > & in segment text", () => {
    const vtt = toVtt([{ start: 0, end: 1, text: "<b>&" }]);
    expect(vtt).toContain("&lt;b&gt;&amp;");
  });
});

describe("toSrt", () => {
  it("emits sequence numbers and HH:MM:SS,mmm timestamps", () => {
    const srt = toSrt([
      { start: 0, end: 1, text: "Hi" },
      { start: 1, end: 2, text: "Bye" },
    ]);
    expect(srt).toContain("00:00:00,000 --> 00:00:01,000");
    expect(srt).toContain("00:00:01,000 --> 00:00:02,000");
    expect(srt.split("\n")[0]).toBe("1");
  });
});

describe("toTranscript", () => {
  it("emits a slide-numbered transcript with mm:ss timecodes", () => {
    const t = toTranscript([
      { start: 0, end: 12, text: "a" },
      { start: 12, end: 30, text: "b" },
    ]);
    expect(t).toContain("[00:00 – 00:12] Slide 1");
    expect(t).toContain("[00:12 – 00:30] Slide 2");
  });
});

describe("toSourceList", () => {
  it("emits a markdown link list of sources with URLs", () => {
    const md = toSourceList("Demo", [
      { title: "Wiki", url: "https://wiki.example", type: "url" },
      { title: "Notes", url: null, type: "text" },
    ]);
    expect(md).toContain("# Source list — Demo");
    expect(md).toContain("[Wiki](https://wiki.example)");
    expect(md).toContain("- Notes");
  });

  it("explains when there are no sources", () => {
    const md = toSourceList("Demo", []);
    expect(md).toContain("No sources attached");
  });
});
