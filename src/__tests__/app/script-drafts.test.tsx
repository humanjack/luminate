import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ScriptPage from "@/app/(workspace)/projects/[id]/script/page";
import type { ProjectWithData } from "@/stores/project-store";

const state = vi.hoisted(() => ({ currentProject: null as ProjectWithData | null, saveScripts: vi.fn(), streamScript: vi.fn() }));
vi.mock("@/stores/project-store", () => ({ useProjectStore: () => state }));
vi.mock("@/stores/settings-store", () => ({ useSettingsStore: () => ({ llmProvider: "anthropic" }) }));
vi.mock("@/hooks/useLLM", () => ({ useLLM: () => ({ streamScript: state.streamScript, hasValidConfig: () => true }) }));
vi.mock("@/components/workflow/step-navigation", () => ({
  StepNavigation: ({ onNext }: { onNext: () => Promise<boolean> }) => <button onClick={() => { void onNext(); }}>Save scripts</button>,
}));
vi.mock("@/components/workflow/llm-progress-panel", () => ({ LLMProgressPanel: () => null }));

function project(slideId: string, text: string): ProjectWithData {
  const now = new Date();
  return {
    id: "p", name: "Project", status: "draft", currentStep: 4, createdAt: now, updatedAt: now,
    slides: [{ id: slideId, projectId: "p", index: 0, markdown: "# Slide", imageData: null, theme: "default", sourceRefs: null, outlineItemId: null, createdAt: now, updatedAt: now }],
    scripts: [{ id: `script-${slideId}`, projectId: "p", slideId, slideIndex: 0, text, speakerNotes: null, estimatedDuration: 1, sourceRefs: null, createdAt: now, updatedAt: now }],
  };
}
const params = Promise.resolve({ id: "p" });
const page = () => <Suspense fallback="Loading"><ScriptPage params={params} /></Suspense>;

it("uses replacement slide IDs after an external deck regeneration instead of saving stale drafts", async () => {
  state.currentProject = project("old-slide", "Original script");
  state.saveScripts.mockResolvedValue(undefined);
  const view = await act(async () => render(page()));
  const editor = () => screen.getByPlaceholderText("Write your script here or click Generate to create one automatically...");
  fireEvent.change(editor(), { target: { value: "Old deck draft" } });
  state.currentProject = project("new-slide", "New deck script");
  view.rerender(page());
  expect(editor()).toHaveValue("New deck script");
  await act(async () => fireEvent.click(screen.getByText("Save scripts")));
  expect(state.saveScripts).toHaveBeenLastCalledWith("p", [expect.objectContaining({ slideId: "new-slide", text: "New deck script" })]);
});


it("does not reuse cached scripts for slide IDs removed by a deck save", async () => {
  state.currentProject = project("old-slide", "Old narration");
  const oldScripts = state.currentProject.scripts;
  const view = await act(async () => render(page()));
  state.currentProject = { ...project("new-slide", ""), scripts: oldScripts };
  view.rerender(page());
  expect(screen.getByPlaceholderText("Write your script here or click Generate to create one automatically...")).toHaveValue("");
});


it("follows external script changes after generation auto-saves the final array", async () => {
  state.currentProject = project("slide", "Original");
  state.streamScript.mockImplementation(async function* () {
    yield { type: "text", content: "Generated narration" };
    yield { type: "done", content: "" };
  });
  state.saveScripts.mockImplementation(async (_id, scripts) => {
    state.currentProject = project("slide", scripts[0].text);
  });
  const view = await act(async () => render(page()));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Generate" })));
  expect(state.saveScripts).toHaveBeenLastCalledWith("p", [expect.objectContaining({ text: "Generated narration" })]);
  expect(screen.getByPlaceholderText("Write your script here or click Generate to create one automatically...")).toHaveValue("Generated narration");
  state.currentProject = project("slide", "External agent narration");
  view.rerender(page());
  expect(screen.getByPlaceholderText("Write your script here or click Generate to create one automatically...")).toHaveValue("External agent narration");
});

it("does not write old generation output into a replacement deck", async () => {
  state.currentProject = project("old-slide", "Original");
  state.saveScripts.mockReset();
  let resume!: () => void;
  const paused = new Promise<void>((resolve) => { resume = resolve; });
  state.streamScript.mockImplementation(async function* () {
    yield { type: "text", content: "Old deck narration" };
    await paused;
    yield { type: "done", content: "" };
  });
  const view = await act(async () => render(page()));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Generate" })));
  state.currentProject = project("new-slide", "New deck narration");
  view.rerender(page());
  await act(async () => resume());
  expect(state.saveScripts).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText("Write your script here or click Generate to create one automatically...")).toHaveValue("New deck narration");
});
