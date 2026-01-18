CREATE TABLE `analysis_results` (
	`id` text PRIMARY KEY NOT NULL,
	`recording_id` text NOT NULL,
	`project_id` text NOT NULL,
	`overall_score` real,
	`pronunciation_score` real,
	`fluency_score` real,
	`confidence_score` real,
	`naturalness_score` real,
	`words_per_minute` real,
	`filler_words` text,
	`segments` text,
	`recommendations` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recording_id`) REFERENCES `recordings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `content_data` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text,
	`format` text DEFAULT 'presentation' NOT NULL,
	`target_length` integer DEFAULT 10 NOT NULL,
	`outline` text,
	`markdown` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`current_step` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`slide_id` text,
	`slide_index` integer,
	`audio_path` text NOT NULL,
	`audio_data` blob,
	`duration` real,
	`waveform_data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`slide_id`) REFERENCES `slides`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `research_data` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`topic` text NOT NULL,
	`depth` text DEFAULT 'detailed' NOT NULL,
	`content` text,
	`sources` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scripts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`slide_id` text,
	`slide_index` integer NOT NULL,
	`text` text NOT NULL,
	`speaker_notes` text,
	`estimated_duration` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`slide_id`) REFERENCES `slides`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slides` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`index` integer NOT NULL,
	`markdown` text NOT NULL,
	`image_data` text,
	`theme` text DEFAULT 'default',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `videos` (
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
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
