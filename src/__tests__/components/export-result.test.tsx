import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportResult } from "@/components/workflow/export-result";

const base = {
  projectName: "My Talk",
  posterMarkdown: "# Title\n- point",
  posterTheme: "default",
  slideCount: 5,
  totalDuration: 95,
  resolution: "1920x1080",
};

describe("ExportResult (#64)", () => {
  it("renders the result hero with stats and a confetti burst", () => {
    render(
      <ExportResult
        {...base}
        artifacts={{ mp4: "/out.mp4" }}
        onDownload={vi.fn()}
        onUploadYouTube={vi.fn()}
      />
    );
    expect(screen.getByTestId("export-result")).toBeInTheDocument();
    expect(screen.getByTestId("export-confetti")).toBeInTheDocument();
    expect(screen.getByText("My Talk")).toBeInTheDocument();
    expect(screen.getByText("1920x1080")).toBeInTheDocument();
    expect(screen.getByText("Your video is ready")).toBeInTheDocument();
  });

  it("downloads the mp4 with a derived filename", () => {
    const onDownload = vi.fn();
    render(
      <ExportResult
        {...base}
        artifacts={{ mp4: "/out.mp4" }}
        onDownload={onDownload}
        onUploadYouTube={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("result-download-mp4"));
    expect(onDownload).toHaveBeenCalledWith("/out.mp4", "My Talk.mp4");
  });

  it("enables artifact chips only when their path exists", () => {
    const onDownload = vi.fn();
    render(
      <ExportResult
        {...base}
        artifacts={{ mp4: "/out.mp4", captions: "/out.vtt" }}
        onDownload={onDownload}
        onUploadYouTube={vi.fn()}
      />
    );
    const captions = screen.getByTestId("result-download-captions");
    const transcript = screen.getByTestId("result-download-transcript");
    expect(captions).toBeEnabled();
    expect(transcript).toBeDisabled();

    fireEvent.click(captions);
    expect(onDownload).toHaveBeenCalledWith("/out.vtt", "My Talk.vtt");
  });

  it("invokes the YouTube upload handler", () => {
    const onUploadYouTube = vi.fn();
    render(
      <ExportResult
        {...base}
        artifacts={{ mp4: "/out.mp4" }}
        onDownload={vi.fn()}
        onUploadYouTube={onUploadYouTube}
      />
    );
    fireEvent.click(screen.getByTestId("result-upload"));
    expect(onUploadYouTube).toHaveBeenCalledOnce();
  });
});
