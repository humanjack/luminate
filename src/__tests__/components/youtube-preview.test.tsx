import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { YouTubePreview } from "@/components/workflow/youtube-preview";

const IMG = "data:image/svg+xml;base64,abc";

describe("YouTubePreview (#63)", () => {
  it("renders the title in both the search row and the sidebar card", () => {
    render(<YouTubePreview imageUrl={IMG} title="How to learn anything fast" />);
    expect(screen.getByTestId("youtube-preview")).toBeInTheDocument();
    // appears once in the search row and once in the sidebar card
    expect(screen.getAllByText("How to learn anything fast")).toHaveLength(2);
  });

  it("uses the provided thumbnail image", () => {
    render(<YouTubePreview imageUrl={IMG} title="t" />);
    const imgs = screen.getAllByAltText("Video thumbnail preview");
    expect(imgs.length).toBeGreaterThanOrEqual(2);
    expect(imgs[0]).toHaveAttribute("src", IMG);
  });

  it("clamps long titles to two lines", () => {
    render(<YouTubePreview imageUrl={IMG} title="A very long title that should not blow out the layout" />);
    const titleEls = screen.getAllByText(/A very long title/);
    expect(titleEls[0].className).toContain("line-clamp-2");
  });

  it("toggles between YouTube dark and light surfaces", () => {
    render(<YouTubePreview imageUrl={IMG} title="t" />);
    const toggle = screen.getByTestId("yt-theme-toggle");
    expect(toggle).toHaveTextContent("Dark");
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("Light");
  });

  it("falls back to a default channel name", () => {
    render(<YouTubePreview imageUrl={IMG} title="t" />);
    expect(screen.getAllByText("Your Channel").length).toBeGreaterThan(0);
  });
});
