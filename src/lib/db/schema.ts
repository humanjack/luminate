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
  // Source claim IDs that back the assertions on this slide
  sourceRefs: text("source_refs", { mode: "json" }).$type<string[]>(),
  outlineItemId: text("outline_item_id"),
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
  // Linked claim ids that this script relies on
  sourceRefs: text("source_refs", { mode: "json" }).$type<string[]>(),
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

// Sources - first-class research sources (URL, pasted text, manual)
export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["url", "text", "manual"] }).notNull(),
  url: text("url"),
  title: text("title"),
  author: text("author"),
  publishedAt: text("published_at"), // ISO date string
  fetchedText: text("fetched_text"),
  status: text("status", { enum: ["pending", "fetched", "approved", "rejected", "failed"] })
    .notNull()
    .default("pending"),
  trustNotes: text("trust_notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Claims - normalized research claims, each linked to >=0 sources
export const claims = sqliteTable("claims", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  // Array of source ids backing this claim. Empty array means unsupported.
  sourceIds: text("source_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["proposed", "approved", "rejected"] })
    .notNull()
    .default("proposed"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Outline items - story structure between research and slides
export const outlineItems = sqliteTable("outline_items", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  speakerGoal: text("speaker_goal"),
  // Linked claim ids
  claimIds: text("claim_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Exports - separate export jobs/artifacts from finished-video metadata
export const exports = sqliteTable("exports", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  videoId: text("video_id").references(() => videos.id, { onDelete: "set null" }),
  status: text("status", { enum: ["pending", "rendering", "encoding", "completed", "failed"] })
    .notNull()
    .default("pending"),
  progress: integer("progress").notNull().default(0), // 0-100
  resolution: text("resolution").notNull().default("1920x1080"),
  outputPath: text("output_path"),
  captionsPath: text("captions_path"),
  transcriptPath: text("transcript_path"),
  sourcesPath: text("sources_path"),
  duration: real("duration"),
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
  sources: many(sources),
  claims: many(claims),
  outlineItems: many(outlineItems),
  exports: many(exports),
}));

export const sourcesRelations = relations(sources, ({ one }) => ({
  project: one(projects, {
    fields: [sources.projectId],
    references: [projects.id],
  }),
}));

export const claimsRelations = relations(claims, ({ one }) => ({
  project: one(projects, {
    fields: [claims.projectId],
    references: [projects.id],
  }),
}));

export const outlineItemsRelations = relations(outlineItems, ({ one }) => ({
  project: one(projects, {
    fields: [outlineItems.projectId],
    references: [projects.id],
  }),
}));

export const exportsRelations = relations(exports, ({ one }) => ({
  project: one(projects, {
    fields: [exports.projectId],
    references: [projects.id],
  }),
  video: one(videos, {
    fields: [exports.videoId],
    references: [videos.id],
  }),
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
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
export type OutlineItem = typeof outlineItems.$inferSelect;
export type NewOutlineItem = typeof outlineItems.$inferInsert;
export type Export = typeof exports.$inferSelect;
export type NewExport = typeof exports.$inferInsert;
export type Setting = typeof settings.$inferSelect;
