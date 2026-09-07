import { afterEach, expect, it, vi } from "vitest";
import { useProjectStore } from "@/stores/project-store";

afterEach(() => { vi.restoreAllMocks(); });

it.each(["saveResearchData", "saveContentData", "saveSlides", "saveScripts"] as const)("%s rejects failed writes so editors retain unsaved drafts", async (action) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(fetch).mockResolvedValue(new Response("Unavailable", { status: 503 }));
  const store = useProjectStore.getState();
  const write = action === "saveResearchData" || action === "saveContentData"
    ? store[action]("p", {}) : store[action]("p", []);
  await expect(write).rejects.toThrow(/Failed to save/);
  expect(useProjectStore.getState().error).toMatch(/Failed to save/);
});
