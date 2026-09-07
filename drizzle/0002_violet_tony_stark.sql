CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`from_step` text NOT NULL,
	`to_step` text NOT NULL,
	`current_step` text,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`error_message` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "agent_runs_status_check" CHECK("agent_runs"."status" IN ('idle', 'running', 'paused', 'completed', 'error', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `idx_agent_runs_project` ON `agent_runs` (`project_id`);--> statement-breakpoint
CREATE TABLE `agent_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`duration_ms` integer,
	`error_message` text,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`run_id`) REFERENCES `agent_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "agent_steps_status_check" CHECK("agent_steps"."status" IN ('pending', 'running', 'completed', 'error', 'skipped'))
);
--> statement-breakpoint
CREATE INDEX `idx_agent_steps_run` ON `agent_steps` (`run_id`);--> statement-breakpoint
CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`text` text NOT NULL,
	`source_ids` text DEFAULT '[]' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "claims_status_check" CHECK("claims"."status" IN ('proposed', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX `idx_claims_project` ON `claims` (`project_id`);--> statement-breakpoint
CREATE TABLE `clip_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`start_sec` real NOT NULL,
	`end_sec` real NOT NULL,
	`hook` text NOT NULL,
	`virality_score` integer NOT NULL,
	`reasoning` text,
	`status` text DEFAULT 'suggested' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "clip_suggestions_status_check" CHECK("clip_suggestions"."status" IN ('suggested', 'kept', 'discarded'))
);
--> statement-breakpoint
CREATE INDEX `idx_clip_suggestions_project` ON `clip_suggestions` (`project_id`);--> statement-breakpoint
CREATE TABLE `exports` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`video_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`resolution` text DEFAULT '1920x1080' NOT NULL,
	`output_path` text,
	`captions_path` text,
	`transcript_path` text,
	`sources_path` text,
	`duration` real,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "exports_status_check" CHECK("exports"."status" IN ('pending', 'rendering', 'encoding', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `idx_exports_project` ON `exports` (`project_id`);--> statement-breakpoint
CREATE TABLE `outline_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`index` integer NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`speaker_goal` text,
	`claim_ids` text DEFAULT '[]' NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_outline_items_project` ON `outline_items` (`project_id`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`url` text,
	`title` text,
	`author` text,
	`published_at` text,
	`fetched_text` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`trust_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sources_type_check" CHECK("sources"."type" IN ('url', 'text', 'manual')),
	CONSTRAINT "sources_status_check" CHECK("sources"."status" IN ('pending', 'fetched', 'approved', 'rejected', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `idx_sources_project` ON `sources` (`project_id`);--> statement-breakpoint
CREATE TABLE `thumbnails` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`preset` text NOT NULL,
	`svg` text NOT NULL,
	`selected` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "thumbnails_preset_check" CHECK("thumbnails"."preset" IN ('bold-text', 'question', 'numbered-list', 'reaction'))
);
--> statement-breakpoint
CREATE INDEX `idx_thumbnails_project` ON `thumbnails` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_thumbnails_selected` ON `thumbnails` (`project_id`) WHERE "thumbnails"."selected" = 1;--> statement-breakpoint
CREATE TABLE `video_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`titles` text DEFAULT '[]' NOT NULL,
	`selected_title_index` integer DEFAULT 0 NOT NULL,
	`description` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_video_metadata_project` ON `video_metadata` (`project_id`);--> statement-breakpoint
ALTER TABLE `scripts` ADD `source_refs` text;--> statement-breakpoint
CREATE INDEX `idx_scripts_project` ON `scripts` (`project_id`);--> statement-breakpoint
ALTER TABLE `slides` ADD `source_refs` text;--> statement-breakpoint
ALTER TABLE `slides` ADD `outline_item_id` text;--> statement-breakpoint
CREATE INDEX `idx_slides_project` ON `slides` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_slides_first` ON `slides` (`project_id`) WHERE "slides"."index" = 0;--> statement-breakpoint
CREATE INDEX `idx_slides_project_index` ON `slides` (`project_id`,`index`);--> statement-breakpoint
CREATE INDEX `idx_analysis_project` ON `analysis_results` (`project_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_content_data` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text,
	`format` text DEFAULT 'presentation' NOT NULL,
	`target_length` integer DEFAULT 10 NOT NULL,
	`outline` text,
	`markdown` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "content_data_format_check" CHECK("__new_content_data"."format" IN ('presentation', 'tutorial', 'explainer'))
);
--> statement-breakpoint
INSERT INTO `__new_content_data`("id", "project_id", "title", "format", "target_length", "outline", "markdown", "created_at", "updated_at") SELECT "id", "project_id", "title", "format", "target_length", "outline", "markdown", "created_at", "updated_at" FROM `content_data`;--> statement-breakpoint
DROP TABLE `content_data`;--> statement-breakpoint
ALTER TABLE `__new_content_data` RENAME TO `content_data`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_content_project` ON `content_data` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_recordings_project` ON `recordings` (`project_id`);--> statement-breakpoint
CREATE TABLE `__new_research_data` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`topic` text NOT NULL,
	`depth` text DEFAULT 'detailed' NOT NULL,
	`content` text,
	`sources` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "research_data_depth_check" CHECK("__new_research_data"."depth" IN ('quick', 'detailed', 'comprehensive'))
);
--> statement-breakpoint
INSERT INTO `__new_research_data`("id", "project_id", "topic", "depth", "content", "sources", "created_at", "updated_at") SELECT "id", "project_id", "topic", "depth", "content", "sources", "created_at", "updated_at" FROM `research_data`;--> statement-breakpoint
DROP TABLE `research_data`;--> statement-breakpoint
ALTER TABLE `__new_research_data` RENAME TO `research_data`;--> statement-breakpoint
CREATE INDEX `idx_research_project` ON `research_data` (`project_id`);--> statement-breakpoint
CREATE TABLE `__new_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`output_path` text,
	`duration` real,
	`resolution` text DEFAULT '1920x1080',
	`status` text DEFAULT 'pending' NOT NULL,
	`progress` integer DEFAULT 0,
	`youtube_url` text,
	`youtube_video_id` text,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "videos_status_check" CHECK("__new_videos"."status" IN ('pending', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
INSERT INTO `__new_videos`("id", "project_id", "output_path", "duration", "resolution", "status", "progress", "youtube_url", "youtube_video_id", "error_message", "created_at", "updated_at") SELECT "id", "project_id", "output_path", "duration", "resolution", "status", "progress", "youtube_url", "youtube_video_id", "error_message", "created_at", "updated_at" FROM `videos`;--> statement-breakpoint
DROP TABLE `videos`;--> statement-breakpoint
ALTER TABLE `__new_videos` RENAME TO `videos`;--> statement-breakpoint
CREATE INDEX `idx_videos_project` ON `videos` (`project_id`);--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`current_step` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "projects_status_check" CHECK("__new_projects"."status" IN ('draft', 'in_progress', 'completed'))
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "name", "current_step", "status", "created_at", "updated_at") SELECT "id", "name", "current_step", "status", "created_at", "updated_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;