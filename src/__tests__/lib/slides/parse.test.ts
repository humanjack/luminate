import { describe, expect, it } from "vitest";
import { parseSlide } from "@/lib/slides/parse";

describe("slides/parse", () => {
  it("extracts title, bullets, and speaker notes", () => {
    const md = `# Why now\n\n- Tax credits extended\n- Panel prices down 70%\n- Net metering survives\n\n<!-- notes: emphasize bullet 2 -->`;
    const slide = parseSlide(md);
    expect(slide.title).toBe("Why now");
    expect(slide.bullets).toEqual([
      "Tax credits extended",
      "Panel prices down 70%",
      "Net metering survives",
    ]);
    // The "notes:" label is intentionally stripped; only the message survives.
    expect(slide.speakerNotes).toBe(": emphasize bullet 2");
  });

  it("treats the first h2 as a subtitle when no h1 has come before", () => {
    const md = `# Big title\n## Subtitle here\n- Bullet`;
    const slide = parseSlide(md);
    expect(slide.title).toBe("Big title");
    expect(slide.subtitle).toBe("Subtitle here");
  });

  it("strips inline markdown markers from rendered text", () => {
    const md = `# **Bold** title\n- A *bullet* with [a link](https://example.com) and \`code\``;
    const slide = parseSlide(md);
    expect(slide.title).toBe("Bold title");
    expect(slide.bullets[0]).toBe("A bullet with a link and code");
  });

  it("captures fenced code blocks with their language", () => {
    const md = "# Snippet\n```ts\nconst x = 1;\nconsole.log(x);\n```";
    const slide = parseSlide(md);
    expect(slide.code).toEqual({ language: "ts", content: "const x = 1;\nconsole.log(x);" });
  });

  it("survives an unclosed fence by absorbing the rest as code", () => {
    const md = "# Oops\n```python\nprint('hi')\n";
    const slide = parseSlide(md);
    expect(slide.code?.language).toBe("python");
    expect(slide.code?.content).toContain("print('hi')");
  });

  it("returns an empty-but-typed slide for empty markdown", () => {
    const slide = parseSlide("");
    expect(slide.title).toBeNull();
    expect(slide.bullets).toEqual([]);
    expect(slide.body).toEqual([]);
    expect(slide.code).toBeNull();
  });

  it("detects a citation/source line as footer", () => {
    const md = `# Claim\n\nMarket grew 22% CAGR.\n\nSource: SEIA 2025 report`;
    const slide = parseSlide(md);
    expect(slide.footer).toBe("Source: SEIA 2025 report");
    // The body should no longer carry that footer line
    expect(slide.body).not.toContain("Source: SEIA 2025 report");
  });

  it("does not leak markdown markers (#, -, **) into rendered fields", () => {
    const md = `# Title\n## Sub\n- Bullet\n**emphatic** prose`;
    const slide = parseSlide(md);
    expect(slide.title).not.toContain("#");
    expect(slide.subtitle).not.toContain("#");
    expect(slide.bullets[0]).not.toContain("-");
    expect(slide.body[0]).not.toContain("**");
  });
});
