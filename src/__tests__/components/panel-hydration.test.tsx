import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectWithData } from "@/stores/project-store";
import type { VideoMetadata } from "@/lib/db/schema";
import { AgentRunPanel } from "@/components/workflow/agent-run-panel";
import { SeoCopilotPanel } from "@/components/workflow/seo-copilot-panel";

const state = vi.hoisted(() => ({ currentProject: null as ProjectWithData | null, loadProject: vi.fn() }));
vi.mock("@/stores/project-store", () => ({ useProjectStore: () => state }));
vi.mock("@/stores/settings-store", () => ({ useSettingsStore: () => ({
  llmProvider: "anthropic", anthropicApiKey: "test", claudeModel: "test", hasValidLLMConfig: () => true,
}) }));
function project(id: string, topic: string): ProjectWithData {
  const date = new Date();
  return { id, name: id, currentStep: 1, status: "draft", createdAt: date, updatedAt: date,
    researchData: { id: `research-${id}`, projectId: id, topic, depth: "quick", content: null, sources: null, createdAt: date, updatedAt: date },
    contentData: { id: `content-${id}`, projectId: id, title: null, format: "tutorial", targetLength: 8, outline: null, markdown: null, createdAt: date, updatedAt: date },
  };
}
function metadata(projectId: string, title: string): VideoMetadata {
  return { id: projectId, projectId, titles: [{ text: title, ctrScore: 80, reasoning: "Clear" }], selectedTitleIndex: 0,
    description: "Saved description", tags: ["test"], createdAt: new Date(), updatedAt: new Date() };
}
beforeEach(() => { state.currentProject = null; vi.clearAllMocks(); });
afterEach(() => vi.unstubAllGlobals());

describe("workflow panel hydration", () => {
  it("hydrates agent settings, keeps edits on refresh, and resets when switching projects", () => {
    const { rerender } = render(<AgentRunPanel key="p1" projectId="p1" />);
    expect(screen.getByLabelText("Topic")).toHaveValue("");
    state.currentProject = project("p1", "Saved topic");
    rerender(<AgentRunPanel key="p1" projectId="p1" />);
    expect(screen.getByLabelText("Topic")).toHaveValue("Saved topic");
    expect(screen.getByRole("spinbutton")).toHaveValue(8);
    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "Edited topic" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "12" } });
    state.currentProject = project("p1", "Refreshed topic");
    rerender(<AgentRunPanel key="p1" projectId="p1" />);
    expect(screen.getByLabelText("Topic")).toHaveValue("Edited topic");
    expect(screen.getByRole("spinbutton")).toHaveValue(12);
    state.currentProject = project("p2", "Other topic");
    rerender(<AgentRunPanel key="p2" projectId="p2" />);
    expect(screen.getByLabelText("Topic")).toHaveValue("Other topic");
    expect(screen.getByRole("spinbutton")).toHaveValue(8);
  });

  it("shows agent streamed step output and completion, then refreshes the project", async () => {
    state.currentProject = project("p1", "Topic");
    const events = [
      { type: "step_started", step: "research" },
      { type: "step_chunk", step: "research", content: "Research evidence" },
      { type: "step_completed", step: "research" },
      { type: "run_completed" },
    ].map((event) => `data: ${JSON.stringify(event)}\n`).join("");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(events)));
    render(<AgentRunPanel projectId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: "Run with AI" }));
    await screen.findByText(/Pipeline finished/);
    expect(screen.getByTestId("agent-step-research")).toHaveTextContent("Research evidence");
    expect(screen.getByTestId("agent-step-research")).toHaveTextContent("completed");
    expect(state.loadProject).toHaveBeenCalledWith("p1");
  });

  it("resets SEO loading on project changes and ignores the previous project's late response", async () => {
    let finishFirst!: (response: Response) => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce(Response.json(metadata("p2", "Second title")));
    vi.stubGlobal("fetch", fetchMock);
    const onMetadataChange = vi.fn();
    const { rerender } = render(<SeoCopilotPanel projectId="p1" onMetadataChange={onMetadataChange} />);
    expect(screen.getByText("Loading saved SEO…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate SEO" })).toBeDisabled();
    rerender(<SeoCopilotPanel projectId="p2" onMetadataChange={onMetadataChange} />);
    expect(await screen.findAllByText("Second title")).toHaveLength(2);
    await act(async () => { finishFirst(Response.json(metadata("p1", "First title"))); });
    expect(screen.queryByText("First title")).not.toBeInTheDocument();
    expect(onMetadataChange).toHaveBeenCalledWith(expect.objectContaining({ projectId: "p2" }));
    expect(onMetadataChange).not.toHaveBeenCalledWith(expect.objectContaining({ projectId: "p1" }));
  });

  it("reports SEO load failures and ends loading", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network unavailable")));
    render(<SeoCopilotPanel projectId="p1" />);
    expect(await screen.findByText("Network unavailable")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Loading saved SEO…")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Generate SEO" })).toBeEnabled();
  });
});
