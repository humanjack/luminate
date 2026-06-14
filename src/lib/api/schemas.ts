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
