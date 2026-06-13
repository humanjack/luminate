import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  VideoPreviewStage,
  transitionClass,
} from "@/components/workflow/video-preview-stage";

const slides = [{ markdown: "# First" }, { markdown: "# Second" }];

describe("transitionClass (#65)", () => {
  it("maps the transition setting to an animation class", () => {
    expect(transitionClass("none")).toBe("");
    expect(transitionClass("fade")).toBe("stage-fade");
    expect(transitionClass("slide")).toBe("stage-slide");
  });
});

describe("VideoPreviewStage (#65)", () => {
  it("renders the active slide with the transition class + slide indicator", () => {
    render(
      <VideoPreviewStage slides={slides} index={0} transition="fade" showCaptions={false} />
    );
    const stage = screen.getByTestId("video-stage-slide");
    expect(stage).toHaveClass("stage-fade");
    expect(screen.getByText("Slide 1 / 2")).toBeInTheDocument();
  });

  it("shows the caption only when enabled and present", () => {
    const { rerender } = render(
      <VideoPreviewStage
        slides={slides}
        index={1}
        transition="none"
        caption="Welcome to the talk"
        showCaptions
      />
    );
    expect(screen.getByTestId("video-stage-caption")).toHaveTextContent(
      "Welcome to the talk"
    );
    expect(screen.getByText("Slide 2 / 2")).toBeInTheDocument();

    rerender(
      <VideoPreviewStage
        slides={slides}
        index={1}
        transition="none"
        caption="Welcome to the talk"
        showCaptions={false}
      />
    );
    expect(screen.queryByTestId("video-stage-caption")).not.toBeInTheDocument();
  });

  it("falls back to an empty state when there is no slide at the index", () => {
    render(
      <VideoPreviewStage slides={[]} index={0} transition="fade" showCaptions />
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("video-stage-slide")).not.toBeInTheDocument();
  });
});
