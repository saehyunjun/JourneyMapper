CREATE TABLE `indication_therapeutic_areas` (
	`indication_id` text NOT NULL,
	`therapeutic_area_id` text NOT NULL,
	PRIMARY KEY(`indication_id`, `therapeutic_area_id`),
	FOREIGN KEY (`indication_id`) REFERENCES `indications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`therapeutic_area_id`) REFERENCES `therapeutic_areas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `indications` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`abbreviation` text,
	`mesh_id` text,
	`mesh_term` text,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `therapeutic_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`mesh_id` text,
	`mesh_term` text
);
--> statement-breakpoint
CREATE TABLE `burden_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`parent_id` text,
	`description` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `burden_categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `drug_indications` (
	`drug_id` text NOT NULL,
	`indication_id` text NOT NULL,
	PRIMARY KEY(`drug_id`, `indication_id`),
	FOREIGN KEY (`drug_id`) REFERENCES `drugs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`indication_id`) REFERENCES `indications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `drugs` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`generic_name` text NOT NULL,
	`brand_names` text NOT NULL,
	`moa_id` text,
	`sponsor_id` text,
	`stage` text NOT NULL,
	`description` text,
	`approved_at` integer,
	`embedding` text,
	FOREIGN KEY (`moa_id`) REFERENCES `mechanisms_of_action`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `mechanisms_of_action` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`description` text NOT NULL,
	`embedding` text
);
--> statement-breakpoint
CREATE TABLE `sponsors` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`headquarters_country` text
);
--> statement-breakpoint
CREATE TABLE `content_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`description` text NOT NULL,
	`typical_metadata` text NOT NULL
);
