import { z } from "zod";

/** Body of POST /api/projects. */
export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
});

/** Body of POST /api/llm/research (matches the researchData.depth enum). */
export const researchGenerateSchema = z.object({
  topic: z.string().trim().min(1, "Topic is required"),
  depth: z.enum(["quick", "detailed", "comprehensive"]).default("detailed"),
});

/** Body of POST /api/projects/[id]/recordings. */
export const recordingCreateSchema = z.object({
  duration: z.number().positive(),
  audioData: z.string().min(1),
  slideId: z.string().optional(),
  slideIndex: z.number().int().optional(),
  waveformData: z.array(z.number()).optional(),
});

/** Bodies of the in-process content and script generation routes. */
export const contentGenerateSchema = z.object({
  research: z.string().trim().min(1, "Research content is required").max(200_000),
  format: z.enum(["presentation", "tutorial", "explainer"]).default("presentation"),
  targetLength: z.number().int().min(1).max(120).default(10),
});
export const scriptGenerateSchema = z.object({
  slideContent: z.string().trim().min(1, "Slide content is required").max(100_000),
  slideIndex: z.number().int().min(0).default(0),
});
