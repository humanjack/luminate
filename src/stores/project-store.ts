import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Project,
  ResearchData,
  ContentData,
  Slide,
  Script,
  Recording,
  AnalysisResult,
  Video,
  Source,
  Claim,
  OutlineItem,
} from "@/lib/db/schema";

export interface ProjectWithData extends Project {
  researchData?: ResearchData | null;
  contentData?: ContentData | null;
  slides?: Slide[];
  scripts?: Script[];
  recordings?: Recording[];
  analysisResults?: AnalysisResult[];
  videos?: Video[];
  sources?: Source[];
  claims?: Claim[];
  outlineItems?: OutlineItem[];
}

interface ProjectState {
  projects: ProjectWithData[];
  currentProject: ProjectWithData | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadProjects: () => Promise<void>;
  loadProject: (id: string) => Promise<ProjectWithData | null>;
  createProject: (name: string) => Promise<ProjectWithData>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: ProjectWithData | null) => void;

  // Research data
  saveResearchData: (projectId: string, data: Partial<ResearchData>) => Promise<void>;

  // Content data
  saveContentData: (projectId: string, data: Partial<ContentData>) => Promise<void>;

  // Outline (issue #5)
  saveOutline: (projectId: string, items: Partial<OutlineItem>[]) => Promise<OutlineItem[]>;

  // Slides
  saveSlides: (projectId: string, slides: Partial<Slide>[]) => Promise<void>;

  // Scripts
  saveScripts: (projectId: string, scripts: Partial<Script>[]) => Promise<void>;

  // Recordings
  saveRecording: (projectId: string, recording: Partial<Recording>) => Promise<Recording>;
  deleteRecording: (id: string) => Promise<void>;

  // Analysis
  saveAnalysisResult: (recordingId: string, projectId: string, result: Partial<AnalysisResult>) => Promise<void>;

  // Video
  saveVideo: (projectId: string, video: Partial<Video>) => Promise<void>;
  updateVideoProgress: (projectId: string, progress: number, status?: Video["status"]) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      currentProject: null,
      isLoading: false,
      error: null,

      loadProjects: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch("/api/projects");
          if (!response.ok) throw new Error("Failed to load projects");
          const projects = await response.json();
          set({ projects, isLoading: false });
        } catch (error) {
          console.error(`loadProjects failed: ${(error as Error).message}`);
          set({ error: (error as Error).message, isLoading: false });
        }
      },

      loadProject: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/projects/${id}`);
          if (!response.ok) {
            // A 404 means the project was deleted or never existed (e.g. a stale id
            // left in persisted localStorage after a DB reset). This is an expected,
            // handleable condition — log it as a warning (not an error, which would
            // trip the Next.js dev overlay) and clear currentProject so callers don't
            // render stale data for the previous project.
            if (response.status === 404) {
              set({ currentProject: null, error: "Project not found", isLoading: false });
              return null;
            }
            throw new Error(`Failed to load project (${response.status})`);
          }
          const project = await response.json();
          set({ currentProject: project, isLoading: false });
          return project;
        } catch (error) {
          console.error(`loadProject(${id}) failed: ${(error as Error).message}`);
          set({ error: (error as Error).message, isLoading: false });
          return null;
        }
      },

      createProject: async (name: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          if (!response.ok) throw new Error("Failed to create project");
          const project = await response.json();
          set((state) => ({
            projects: [project, ...state.projects],
            currentProject: project,
            isLoading: false,
          }));
          return project;
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      updateProject: async (id: string, data: Partial<Project>) => {
        try {
          const response = await fetch(`/api/projects/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error("Failed to update project");
          const updated = await response.json();
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? { ...p, ...updated } : p)),
            currentProject: state.currentProject?.id === id
              ? { ...state.currentProject, ...updated }
              : state.currentProject,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      deleteProject: async (id: string) => {
        try {
          const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Failed to delete project");
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
            currentProject: state.currentProject?.id === id ? null : state.currentProject,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      setCurrentProject: (project) => set({ currentProject: project }),

      saveResearchData: async (projectId: string, data: Partial<ResearchData>) => {
        try {
          const response = await fetch(`/api/projects/${projectId}/research`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error("Failed to save research data");
          const researchData = await response.json();
          set((state) => ({
            currentProject: state.currentProject?.id === projectId
              ? { ...state.currentProject, researchData }
              : state.currentProject,
          }));
        } catch (error) {
          console.error(`saveResearchData(${projectId}) failed: ${(error as Error).message}`);
          set({ error: (error as Error).message });
        }
      },

      saveContentData: async (projectId: string, data: Partial<ContentData>) => {
        try {
          const response = await fetch(`/api/projects/${projectId}/content`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error("Failed to save content data");
          const contentData = await response.json();
          set((state) => ({
            currentProject: state.currentProject?.id === projectId
              ? { ...state.currentProject, contentData }
              : state.currentProject,
          }));
        } catch (error) {
          console.error(`saveContentData(${projectId}) failed: ${(error as Error).message}`);
          set({ error: (error as Error).message });
        }
      },

      saveOutline: async (projectId: string, items: Partial<OutlineItem>[]) => {
        try {
          const response = await fetch(`/api/projects/${projectId}/outline`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
          if (!response.ok) {
            const detail = await response.text();
            throw new Error(`Failed to save outline: ${response.status} ${detail}`);
          }
          const saved = (await response.json()) as OutlineItem[];
          set((state) => ({
            currentProject: state.currentProject?.id === projectId
              ? { ...state.currentProject, outlineItems: saved }
              : state.currentProject,
          }));
          return saved;
        } catch (error) {
          console.error(`saveOutline failed: ${(error as Error).message}`);
          set({ error: (error as Error).message });
          throw error;
        }
      },

      saveSlides: async (projectId: string, slides: Partial<Slide>[]) => {
        try {
          const response = await fetch(`/api/projects/${projectId}/slides`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slides }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`saveSlides failed: ${response.status} - ${errorText}`);
            throw new Error(`Failed to save slides: ${response.status}`);
          }
          const savedSlides = await response.json();
          set((state) => ({
            currentProject: state.currentProject?.id === projectId
              ? { ...state.currentProject, slides: savedSlides }
              : state.currentProject,
          }));
        } catch (error) {
          console.error(`saveSlides error: ${(error as Error).message}`);
          set({ error: (error as Error).message });
          throw error; // Re-throw so the caller knows it failed
        }
      },

      saveScripts: async (projectId: string, scripts: Partial<Script>[]) => {
        try {
          const response = await fetch(`/api/projects/${projectId}/scripts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scripts }),
          });
          if (!response.ok) throw new Error("Failed to save scripts");
          const savedScripts = await response.json();
          set((state) => ({
            currentProject: state.currentProject?.id === projectId
              ? { ...state.currentProject, scripts: savedScripts }
              : state.currentProject,
          }));
        } catch (error) {
          console.error(`saveScripts(${projectId}) failed: ${(error as Error).message}`);
          set({ error: (error as Error).message });
        }
      },

      saveRecording: async (projectId: string, recording: Partial<Recording>) => {
        try {
          const response = await fetch(`/api/projects/${projectId}/recordings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(recording),
          });
          if (!response.ok) throw new Error("Failed to save recording");
          const savedRecording = await response.json();
          set((state) => ({
            currentProject: state.currentProject?.id === projectId
              ? {
                  ...state.currentProject,
                  recordings: [...(state.currentProject.recordings || []), savedRecording]
                }
              : state.currentProject,
          }));
          return savedRecording;
        } catch (error) {
          set({ error: (error as Error).message });
          throw error;
        }
      },

      deleteRecording: async (id: string) => {
        try {
          const response = await fetch(`/api/recordings/${id}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Failed to delete recording");
          set((state) => ({
            currentProject: state.currentProject
              ? {
                  ...state.currentProject,
                  recordings: state.currentProject.recordings?.filter((r) => r.id !== id),
                }
              : null,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      saveAnalysisResult: async (recordingId: string, projectId: string, result: Partial<AnalysisResult>) => {
        try {
          const response = await fetch(`/api/projects/${projectId}/analysis`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordingId, ...result }),
          });
          if (!response.ok) throw new Error("Failed to save analysis result");
          const savedResult = await response.json();
          set((state) => ({
            currentProject: state.currentProject?.id === projectId
              ? {
                  ...state.currentProject,
                  analysisResults: [...(state.currentProject.analysisResults || []), savedResult],
                }
              : state.currentProject,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      saveVideo: async (projectId: string, video: Partial<Video>) => {
        try {
          const response = await fetch(`/api/projects/${projectId}/video`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(video),
          });
          if (!response.ok) throw new Error("Failed to save video");
          const savedVideo = await response.json();
          set((state) => ({
            currentProject: state.currentProject?.id === projectId
              ? {
                  ...state.currentProject,
                  videos: [...(state.currentProject.videos || []), savedVideo],
                }
              : state.currentProject,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      updateVideoProgress: async (projectId: string, progress: number, status?: Video["status"]) => {
        try {
          const response = await fetch(`/api/projects/${projectId}/video/progress`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ progress, status }),
          });
          if (!response.ok) throw new Error("Failed to update video progress");
          const updated = await response.json();
          set((state) => ({
            currentProject: state.currentProject?.id === projectId
              ? {
                  ...state.currentProject,
                  videos: state.currentProject.videos?.map((v) =>
                    v.id === updated.id ? updated : v
                  ),
                }
              : state.currentProject,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },
    }),
    {
      name: "luminate-projects",
      partialize: (state) => ({
        // Only persist projects list, not currentProject which should be loaded fresh
        projects: state.projects,
      }),
    }
  )
);
