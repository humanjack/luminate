import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContentPage from "@/app/(workspace)/projects/[id]/content/page";
import type { ProjectWithData } from "@/stores/project-store";

const state = vi.hoisted(() => ({ currentProject: null as ProjectWithData | null, saveContentData: vi.fn() }));
vi.mock("@/stores/project-store", () => ({ useProjectStore: () => state }));
vi.mock("@/stores/settings-store", () => ({
  useSettingsStore: () => ({ hasValidServerLLMConfig: () => true, llmProvider: "anthropic" }),
}));
vi.mock("@/hooks/useLLM", () => ({ useLLM: () => ({ streamContent: vi.fn() }) }));
vi.mock("@/components/workflow/step-navigation", () => ({ StepNavigation: ({ onNext }: { onNext: () => Promise<boolean> }) => <button onClick={() => { void onNext(); }}>Save draft</button> }));
vi.mock("@/components/workflow/llm-progress-panel", () => ({ LLMProgressPanel: () => null }));
vi.mock("@/components/workflow/outline-editor", () => ({ OutlineEditor: () => null }));

function project(id: string, title: string): ProjectWithData {
  const now = new Date();
  return {
    id, name: id, status: "draft", currentStep: 2, createdAt: now, updatedAt: now,
    contentData: {
      id: `content-${id}`, projectId: id, title, format: "presentation", targetLength: 10,
      markdown: `# ${title}`, outline: [], createdAt: now, updatedAt: now,
    },
  };
}

const paramsA = Promise.resolve({ id: "a" });
const paramsB = Promise.resolve({ id: "b" });
const page = (params = paramsA) => <Suspense fallback="Loading"><ContentPage params={params} /></Suspense>;

beforeEach(() => { state.currentProject = null; state.saveContentData.mockReset(); });

describe("content editor hydration and drafts", () => {
  it("hydrates late data but preserves an edited title through unrelated project refreshes", async () => {
    const view = await act(async () => render(page()));
    expect(screen.getByLabelText("Presentation Title")).toHaveValue("");
    state.currentProject = project("a", "Saved title");
    view.rerender(page());
    expect(screen.getByLabelText("Presentation Title")).toHaveValue("Saved title");
    fireEvent.change(screen.getByLabelText("Presentation Title"), { target: { value: "My draft" } });
    state.currentProject = { ...project("a", "Saved title"), name: "Renamed elsewhere" };
    view.rerender(page());
    expect(screen.getByLabelText("Presentation Title")).toHaveValue("My draft");
  });

  it("preserves typing that starts before hydration while hydrating untouched fields", async () => {
    const view = await act(async () => render(page()));
    fireEvent.change(screen.getByLabelText("Presentation Title"), { target: { value: "Typed early" } });
    state.currentProject = project("a", "Server title");
    view.rerender(page());
    expect(screen.getByLabelText("Presentation Title")).toHaveValue("Typed early");
    expect(screen.getByPlaceholderText("Your presentation content will appear here in Slidev markdown format...")).toHaveValue("# Server title");
  });

  it("keeps intentional empty edits and resets drafts when switching projects", async () => {
    state.currentProject = project("a", "Project A title");
    const view = await act(async () => render(page()));
    fireEvent.change(screen.getByLabelText("Presentation Title"), { target: { value: "" } });
    state.currentProject = project("a", "Refreshed A title");
    view.rerender(page());
    expect(screen.getByLabelText("Presentation Title")).toHaveValue("");
    // Navigation can precede store hydration. Never seed B's draft from A.
    await act(async () => view.rerender(page(paramsB)));
    expect(screen.getByLabelText("Presentation Title")).toHaveValue("");
    state.currentProject = project("b", "Project B title");
    view.rerender(page(paramsB));
    expect(screen.getByLabelText("Presentation Title")).toHaveValue("Project B title");
  });
  it("follows external content after successful save, but preserves failed-save drafts", async () => {
    state.currentProject = project("a", "Original");
    state.saveContentData.mockImplementation(async (_id, data) => {
      state.currentProject = { ...state.currentProject!, contentData: { ...state.currentProject!.contentData!, ...data } };
    });
    const view = await act(async () => render(page()));
    fireEvent.change(screen.getByLabelText("Presentation Title"), { target: { value: "Saved draft" } });
    await act(async () => fireEvent.click(screen.getByText("Save draft")));
    state.currentProject = project("a", "Agent's newer content");
    view.rerender(page());
    expect(screen.getByLabelText("Presentation Title")).toHaveValue("Agent's newer content");
    fireEvent.change(screen.getByLabelText("Presentation Title"), { target: { value: "Retry me" } });
    state.saveContentData.mockRejectedValueOnce(new Error("Offline"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => fireEvent.click(screen.getByText("Save draft")));
    state.currentProject = project("a", "Another refresh");
    view.rerender(page());
    expect(screen.getByLabelText("Presentation Title")).toHaveValue("Retry me");
    error.mockRestore();
  });

});
