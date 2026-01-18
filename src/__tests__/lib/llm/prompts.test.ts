import { describe, it, expect } from "vitest";
import {
  RESEARCH_SYSTEM_PROMPT,
  CONTENT_SYSTEM_PROMPT,
  SCRIPT_SYSTEM_PROMPT,
  getResearchPrompt,
  getContentPrompt,
  getScriptPrompt,
} from "@/lib/llm/prompts";

describe("System Prompts", () => {
  describe("RESEARCH_SYSTEM_PROMPT", () => {
    it("should be a non-empty string", () => {
      expect(typeof RESEARCH_SYSTEM_PROMPT).toBe("string");
      expect(RESEARCH_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it("should contain key research instructions", () => {
      expect(RESEARCH_SYSTEM_PROMPT).toContain("research");
      expect(RESEARCH_SYSTEM_PROMPT).toContain("YouTube");
      expect(RESEARCH_SYSTEM_PROMPT).toContain("markdown");
    });

    it("should mention sources", () => {
      expect(RESEARCH_SYSTEM_PROMPT.toLowerCase()).toContain("source");
    });
  });

  describe("CONTENT_SYSTEM_PROMPT", () => {
    it("should be a non-empty string", () => {
      expect(typeof CONTENT_SYSTEM_PROMPT).toBe("string");
      expect(CONTENT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it("should contain content creation instructions", () => {
      expect(CONTENT_SYSTEM_PROMPT).toContain("content");
      expect(CONTENT_SYSTEM_PROMPT).toContain("slide");
    });

    it("should mention Slidev format", () => {
      expect(CONTENT_SYSTEM_PROMPT).toContain("---");
    });
  });

  describe("SCRIPT_SYSTEM_PROMPT", () => {
    it("should be a non-empty string", () => {
      expect(typeof SCRIPT_SYSTEM_PROMPT).toBe("string");
      expect(SCRIPT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it("should contain script writing instructions", () => {
      expect(SCRIPT_SYSTEM_PROMPT).toContain("script");
      expect(SCRIPT_SYSTEM_PROMPT.toLowerCase()).toContain("conversational");
    });
  });
});

describe("getResearchPrompt", () => {
  it("should include the topic in the prompt", () => {
    const prompt = getResearchPrompt("React Hooks", "quick");
    expect(prompt).toContain("React Hooks");
  });

  it("should include quick depth instructions", () => {
    const prompt = getResearchPrompt("Test Topic", "quick");
    expect(prompt).toContain("300-500 words");
  });

  it("should include detailed depth instructions", () => {
    const prompt = getResearchPrompt("Test Topic", "detailed");
    expect(prompt).toContain("800-1200 words");
  });

  it("should include comprehensive depth instructions", () => {
    const prompt = getResearchPrompt("Test Topic", "comprehensive");
    expect(prompt).toContain("1500-2500 words");
  });

  it("should include structure instructions", () => {
    const prompt = getResearchPrompt("Test Topic", "quick");
    expect(prompt).toContain("Key Points");
    expect(prompt).toContain("Introduction");
    expect(prompt).toContain("Main Content");
    expect(prompt).toContain("Practical Applications");
    expect(prompt).toContain("Sources");
  });

  it("should handle special characters in topic", () => {
    const prompt = getResearchPrompt("C++ & JavaScript", "quick");
    expect(prompt).toContain("C++ & JavaScript");
  });

  it("should handle empty topic", () => {
    const prompt = getResearchPrompt("", "quick");
    expect(typeof prompt).toBe("string");
  });
});

describe("getContentPrompt", () => {
  const sampleResearch = "This is sample research content about React.";

  it("should include the research content", () => {
    const prompt = getContentPrompt(sampleResearch, "presentation", 10);
    expect(prompt).toContain(sampleResearch);
  });

  it("should include format type - presentation", () => {
    const prompt = getContentPrompt(sampleResearch, "presentation", 10);
    expect(prompt).toContain("presentation");
  });

  it("should include format type - tutorial", () => {
    const prompt = getContentPrompt(sampleResearch, "tutorial", 10);
    expect(prompt).toContain("tutorial");
  });

  it("should include format type - explainer", () => {
    const prompt = getContentPrompt(sampleResearch, "explainer", 10);
    expect(prompt).toContain("explainer");
  });

  it("should include target length", () => {
    const prompt = getContentPrompt(sampleResearch, "presentation", 10);
    expect(prompt).toContain("10-minute");
  });

  it("should calculate appropriate slide range for 10 minutes", () => {
    const prompt = getContentPrompt(sampleResearch, "presentation", 10);
    // 10 minutes: Math.ceil(10/2) = 5 to Math.ceil(10*0.8) = 8 slides
    expect(prompt).toContain("5");
    expect(prompt).toContain("8");
  });

  it("should calculate appropriate slide range for 5 minutes", () => {
    const prompt = getContentPrompt(sampleResearch, "presentation", 5);
    // 5 minutes: Math.ceil(5/2) = 3 to Math.ceil(5*0.8) = 4 slides
    expect(prompt).toContain("3");
    expect(prompt).toContain("4");
  });

  it("should mention Slidev format", () => {
    const prompt = getContentPrompt(sampleResearch, "presentation", 10);
    expect(prompt).toContain("Slidev");
    expect(prompt).toContain("---");
  });

  it("should mention speaker notes", () => {
    const prompt = getContentPrompt(sampleResearch, "presentation", 10);
    expect(prompt).toContain("notes");
  });
});

describe("getScriptPrompt", () => {
  const slideContent = "# Introduction\n- Point 1\n- Point 2";

  it("should include the slide content", () => {
    const prompt = getScriptPrompt(slideContent, 0);
    expect(prompt).toContain(slideContent);
  });

  it("should include correct slide number (1-indexed)", () => {
    const prompt0 = getScriptPrompt(slideContent, 0);
    expect(prompt0).toContain("slide 1");

    const prompt5 = getScriptPrompt(slideContent, 5);
    expect(prompt5).toContain("slide 6");
  });

  it("should include word count guidelines", () => {
    const prompt = getScriptPrompt(slideContent, 0);
    expect(prompt).toContain("75-150 words");
  });

  it("should mention conversational tone", () => {
    const prompt = getScriptPrompt(slideContent, 0);
    expect(prompt.toLowerCase()).toContain("conversational");
  });

  it("should request only script text", () => {
    const prompt = getScriptPrompt(slideContent, 0);
    expect(prompt).toContain("ONLY the script text");
  });

  it("should handle markdown content correctly", () => {
    const markdownSlide = `# Title
## Subtitle
- **Bold point**
- *Italic point*
\`\`\`code\`\`\``;
    const prompt = getScriptPrompt(markdownSlide, 0);
    expect(prompt).toContain("# Title");
    expect(prompt).toContain("**Bold point**");
  });
});
