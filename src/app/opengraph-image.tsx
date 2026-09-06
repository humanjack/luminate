import { ImageResponse } from "next/og";

export const alt = "Luminate — YouTube Video Automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamically generated social card — no binary asset to maintain.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #1e1b4b 0%, #6d28d9 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 84, fontWeight: 700 }}>
          Luminate
        </div>
        <div style={{ display: "flex", fontSize: 40, marginTop: 24, color: "#ddd6fe" }}>
          YouTube Video Automation
        </div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 40, color: "#c4b5fd" }}>
          Research - Content - Slides - Script - Recording - Analysis - Video
        </div>
      </div>
    ),
    { ...size }
  );
}
