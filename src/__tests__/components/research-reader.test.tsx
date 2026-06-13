import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ResearchReader,
  extractHeadings,
  parseReferences,
  slugify,
} from "@/components/workflow/research-reader";

describe("slugify", () => {
  it("kebab-cases and strips punctuation", () => {
    expect(slugify("The Big Bang!")).toBe("the-big-bang");
  });
});

describe("extractHeadings", () => {
  it("pulls h1–h3 with de-duplicated ids", () => {
    const md = "# Intro\n## Part\nbody\n## Part\n### Deep";
    const h = extractHeadings(md);
    expect(h.map((x) => [x.level, x.id])).toEqual([
      [1, "intro"],
      [2, "part"],
      [2, "part-1"],
      [3, "deep"],
    ]);
  });
});

describe("parseReferences", () => {
  it("collects reference-style citation targets", () => {
    const md = "Body text [1].\n\n[1]: https://example.com\n[2]: https://b.com";
    expect(parseReferences(md)).toEqual({
      "1": "https://example.com",
      "2": "https://b.com",
    });
  });
});

describe("ResearchReader", () => {
  it("renders a TOC when there are 3+ headings", () => {
    const md = "# A\n## B\n### C\ntext";
    render(<ResearchReader markdown={md} />);
    expect(screen.getByTestId("research-toc")).toBeInTheDocument();
    // heading element exists with an anchor id
    expect(document.getElementById("a")).not.toBeNull();
  });

  it("omits the TOC when there are fewer than 3 headings", () => {
    render(<ResearchReader markdown={"# Only\nsome text"} />);
    expect(screen.queryByTestId("research-toc")).not.toBeInTheDocument();
  });

  it("renders citation chips and links the chip when a reference exists", () => {
    const md = "Claim one [1] and two [2].\n\n[1]: https://example.com";
    render(<ResearchReader markdown={md} />);
    const chips = screen.getAllByTestId("citation-chip");
    expect(chips).toHaveLength(2);
    // [1] is wrapped in an anchor to its reference; [2] is not
    expect(chips[0].closest("a")).not.toBeNull();
    expect(chips[1].closest("a")).toBeNull();
    // sources section lists the reference
    expect(screen.getByTestId("research-sources")).toHaveTextContent(
      "https://example.com"
    );
  });

  it("renders bold, links and lists", () => {
    const md = "**bold** and [site](https://x.com)\n\n- one\n- two";
    render(<ResearchReader markdown={md} />);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    const link = screen.getByText("site");
    expect(link).toHaveAttribute("href", "https://x.com");
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
  });
});
