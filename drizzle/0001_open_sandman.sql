CREATE TABLE `content_item_indications` (
	`content_item_id` text NOT NULL,
	`indication_id` text NOT NULL,
	PRIMARY KEY(`content_item_id`, `indication_id`),
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`indication_id`) REFERENCES `indications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`content_source_id` text NOT NULL,
	`raw_text` text NOT NULL,
	`title` text,
	`url` text,
	`author_handle` text,
	`author_attribution_type` text,
	`platform` text,
	`captured_at` integer NOT NULL,
	`published_at` integer,
	`source_metadata` text,
	`embedding` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`content_source_id`) REFERENCES `content_sources`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_content_items_source` ON `content_items` (`content_source_id`);--> statement-breakpoint
CREATE INDEX `idx_content_items_captured` ON `content_items` (`captured_at`);--> statement-breakpoint
CREATE INDEX `idx_content_items_platform` ON `content_items` (`platform`);--> statement-breakpoint
CREATE TABLE `segments` (
	`id` text PRIMARY KEY NOT NULL,
	`content_item_id` text NOT NULL,
	`text` text NOT NULL,
	`char_start` integer NOT NULL,
	`char_end` integer NOT NULL,
	`segment_index` integer NOT NULL,
	`sentiment` real,
	`confidence` real,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`embedding` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_segments_content_item` ON `segments` (`content_item_id`);--> statement-breakpoint
CREATE INDEX `idx_segments_review_status` ON `segments` (`review_status`);