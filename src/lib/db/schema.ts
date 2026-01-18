import { sqliteTable, text, integer, real, blob } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Projects table - main entity
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currentStep: integer("current_step").notNull().default(1),
  status: text("status", { enum: ["draft", "in_progress", "completed"] }).notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Research data - step 1
export const researchData = sqliteTable("research_data", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  depth: text("depth", { enum: ["quick", "detailed", "comprehensive"] }).notNull().default("detailed"),
  content: text("content"), // The generated research content (markdown)
  sources: text("sources", { mode: "json" }).$type<Array<{ title: string; url: string; snippet?: string }>>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Content data - step 2
export const contentData = sqliteTable("content_data", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title"),
  format: text("format", { enum: ["presentation", "tutorial", "explainer"] }).notNull().default("presentation"),
  targetLength: integer("target_length").notNull().default(10), // minutes
  outline: text("outline", { mode: "json" }).$type<Array<{ title: string; points: string[] }>>(),
  markdown: text("markdown"), // Full presentation content
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Slides - step 3
export const slides = sqliteTable("slides", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  markdown: text("markdown").notNull(), // Slidev markdown for this slide
  imageData: text("image_data"), // Base64 encoded PNG or path to image file
  theme: text("theme").default("default"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Scripts - step 4
export const scripts = sqliteTable("scripts", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  slideId: text("slide_id").references(() => slides.id, { onDelete: "cascade" }),
  slideIndex: integer("slide_index").notNull(),
  text: text("text").notNull(),
  speakerNotes: text("speaker_notes"),
  estimatedDuration: integer("estimated_duration"), // seconds
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Recordings - step 5
export const recordings = sqliteTable("recordings", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  slideId: text("slide_id").references(() => slides.id, { onDelete: "cascade" }),
  slideIndex: integer("slide_index"),
  audioPath: text("audio_path").notNull(), // Path to audio file
  audioData: blob("audio_data", { mode: "buffer" }), // Or store audio directly
  duration: real("duration"), // seconds
  waveformData: text("waveform_data", { mode: "json" }).$type<number[]>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Analysis results - step 6
export const analysisResults = sqliteTable("analysis_results", {
  id: text("id").primaryKey(),
  recordingId: text("recording_id").notNull().references(() => recordings.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  overallScore: real("overall_score"),
  pronunciationScore: real("pronunciation_score"),
  fluencyScore: real("fluency_score"),
  confidenceScore: real("confidence_score"),
  naturalnessScore: real("naturalness_score"),
  wordsPerMinute: real("words_per_minute"),
  fillerWords: text("filler_words", { mode: "json" }).$type<Array<{ word: string; count: number; timestamps: number[] }>>(),
  segments: text("segments", { mode: "json" }).$type<Array<{
    word: string;
    startTime: number;
    endTime: number;
    pronunciationScore?: number;
    phonemes?: Array<{ phoneme: string; score: number }>;
  }>>(),
  recommendations: text("recommendations", { mode: "json" }).$type<string[]>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Videos - step 7
export const videos = sqliteTable("videos", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  outputPath: text("output_path"),
  duration: real("duration"),
  resolution: text("resolution").default("1920x1080"),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).notNull().default("pending"),
  progress: integer("progress").default(0), // 0-100
  youtubeUrl: text("youtube_url"),
  youtubeVideoId: text("youtube_video_id"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Settings table for API keys and preferences
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Relations
export const projectsRelations = relations(projects, ({ one, many }) => ({
  researchData: one(researchData),
  contentData: one(contentData),
  slides: many(slides),
  scripts: many(scripts),
  recordings: many(recordings),
  analysisResults: many(analysisResults),
  videos: many(videos),
}));

export const researchDataRelations = relations(researchData, ({ one }) => ({
  project: one(projects, {
    fields: [researchData.projectId],
    references: [projects.id],
  }),
}));

export const contentDataRelations = relations(contentData, ({ one }) => ({
  project: one(projects, {
    fields: [contentData.projectId],
    references: [projects.id],
  }),
}));

export const slidesRelations = relations(slides, ({ one, many }) => ({
  project: one(projects, {
    fields: [slides.projectId],
    references: [projects.id],
  }),
  scripts: many(scripts),
  recordings: many(recordings),
}));

export const scriptsRelations = relations(scripts, ({ one }) => ({
  project: one(projects, {
    fields: [scripts.projectId],
    references: [projects.id],
  }),
  slide: one(slides, {
    fields: [scripts.slideId],
    references: [slides.id],
  }),
}));

export const recordingsRelations = relations(recordings, ({ one, many }) => ({
  project: one(projects, {
    fields: [recordings.projectId],
    references: [projects.id],
  }),
  slide: one(slides, {
    fields: [recordings.slideId],
    references: [slides.id],
  }),
  analysisResults: many(analysisResults),
}));

export const analysisResultsRelations = relations(analysisResults, ({ one }) => ({
  recording: one(recordings, {
    fields: [analysisResults.recordingId],
    references: [recordings.id],
  }),
  project: one(projects, {
    fields: [analysisResults.projectId],
    references: [projects.id],
  }),
}));

export const videosRelations = relations(videos, ({ one }) => ({
  project: one(projects, {
    fields: [videos.projectId],
    references: [projects.id],
  }),
}));

// Type exports
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ResearchData = typeof researchData.$inferSelect;
export type NewResearchData = typeof researchData.$inferInsert;
export type ContentData = typeof contentData.$inferSelect;
export type NewContentData = typeof contentData.$inferInsert;
export type Slide = typeof slides.$inferSelect;
export type NewSlide = typeof slides.$inferInsert;
export type Script = typeof scripts.$inferSelect;
export type NewScript = typeof scripts.$inferInsert;
export type Recording = typeof recordings.$inferSelect;
export type NewRecording = typeof recordings.$inferInsert;
export type AnalysisResult = typeof analysisResults.$inferSelect;
export type NewAnalysisResult = typeof analysisResults.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type Setting = typeof settings.$inferSelect;
