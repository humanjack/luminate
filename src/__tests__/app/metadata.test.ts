import { describe, it, expect, vi } from "vitest";

// next/font/google requires the Next build pipeline; stub it for the import.
vi.mock("next/font/google", () => ({
  Inter: () => ({ className: "font-inter" }),
}));

import { metadata, viewport } from "@/app/layout";

describe("root metadata", () => {
  it("uses a title template and a metadataBase URL", () => {
    expect(typeof metadata.title).toBe("object");
    const title = metadata.title as { default: string; template: string };
    expect(title.template).toBe("%s · Luminate");
    expect(title.default).toMatch(/Luminate/);
    expect(metadata.metadataBase).toBeInstanceOf(URL);
  });

  it("declares openGraph and a summary_large_image twitter card", () => {
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.siteName).toBe("Luminate");
    expect((metadata.twitter as { card?: string })?.card).toBe("summary_large_image");
    expect(metadata.applicationName).toBe("Luminate");
  });
});

describe("root viewport", () => {
  it("sets colorScheme and themeColor for light + dark", () => {
    expect(viewport.colorScheme).toBe("light dark");
    expect(Array.isArray(viewport.themeColor)).toBe(true);
    expect((viewport.themeColor as unknown[]).length).toBe(2);
  });
});
