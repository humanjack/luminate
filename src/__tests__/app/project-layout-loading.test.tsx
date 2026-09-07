import { Suspense, type ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import ProjectLayout from "@/app/(workspace)/projects/[id]/layout";
import type { ProjectWithData } from "@/stores/project-store";

const state = vi.hoisted(() => ({
  currentProject: null as ProjectWithData | null,
  loadProject: vi.fn<(id: string) => Promise<ProjectWithData | null>>(),
}));
const navigation = vi.hoisted(() => ({ pathname: "/projects/a/research" }));
const workflow = vi.hoisted(() => ({ setMaxCompletedStep: vi.fn(), setCurrentStep: vi.fn() }));
vi.mock("@/stores/project-store", () => ({ useProjectStore: () => state }));
vi.mock("@/stores/workflow-store", () => ({ useWorkflowStore: () => workflow }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => navigation.pathname }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/components/workflow/workflow-stepper", () => ({ WorkflowStepper: () => null }));
vi.mock("@/components/workflow/agent-run-panel", () => ({ AgentRunPanel: () => null }));
vi.mock("@/components/ui/theme-toggle", () => ({ ThemeToggle: () => null }));

function project(id: string): ProjectWithData {
  return { id, name: `Project ${id}`, status: "draft", currentStep: 1, createdAt: new Date(), updatedAt: new Date() };
}
const paramsA = Promise.resolve({ id: "a" });
const paramsB = Promise.resolve({ id: "b" });
function page(params = paramsA) {
  return <Suspense fallback="Suspended"><ProjectLayout params={params}>Editor content</ProjectLayout></Suspense>;
}

beforeEach(() => {
  state.currentProject = null;
  state.loadProject.mockReset();
  navigation.pathname = "/projects/a/research";
});

it("does not carry a missing project result into the next project while it loads", async () => {
  let finishB!: (value: ProjectWithData | null) => void;
  state.loadProject.mockResolvedValueOnce(null).mockImplementationOnce(() => new Promise((resolve) => { finishB = resolve; }));
  const view = await act(async () => render(page()));
  expect(screen.getByText("Project not found")).toBeInTheDocument();
  navigation.pathname = "/projects/b/research";
  await act(async () => view.rerender(page(paramsB)));
  expect(screen.queryByText("Project not found")).not.toBeInTheDocument();
  expect(screen.getByText("Loading project...")).toBeInTheDocument();
  state.currentProject = project("b");
  await act(async () => finishB(state.currentProject));
  expect(screen.getByText("Project b")).toBeInTheDocument();
  expect(screen.getByText("Editor content")).toBeInTheDocument();
});

it("ignores an old project's delayed failure after navigation", async () => {
  let finishA!: (value: ProjectWithData | null) => void;
  state.loadProject.mockImplementationOnce(() => new Promise((resolve) => { finishA = resolve; })).mockResolvedValueOnce(project("b"));
  const view = await act(async () => render(page()));
  state.currentProject = project("b");
  navigation.pathname = "/projects/b/research";
  await act(async () => view.rerender(page(paramsB)));
  await act(async () => finishA(null));
  expect(screen.getByText("Project b")).toBeInTheDocument();
  expect(screen.queryByText("Project not found")).not.toBeInTheDocument();
});
