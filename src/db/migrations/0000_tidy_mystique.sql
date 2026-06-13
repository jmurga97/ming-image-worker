CREATE TABLE `image_upload_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`preset_id` text NOT NULL,
	`preset_version` integer NOT NULL,
	`storage_profile_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_fingerprint` text NOT NULL,
	`external_id` text,
	`original_bucket` text NOT NULL,
	`original_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`declared_content_type` text NOT NULL,
	`declared_size_bytes` integer NOT NULL,
	`detected_content_type` text,
	`detected_size_bytes` integer,
	`source_width` integer,
	`source_height` integer,
	`status` text DEFAULT 'awaiting_upload' NOT NULL,
	`lease_expires_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`retain_original` integer DEFAULT true NOT NULL,
	`original_retention_status` text DEFAULT 'pending' NOT NULL,
	`error_code` text,
	`error_message` text,
	`error_retryable` integer,
	`operational_metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`queued_at` text,
	`processing_started_at` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `image_upload_jobs_product_idempotency_unique` ON `image_upload_jobs` (`product_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `image_upload_jobs_original_object_unique` ON `image_upload_jobs` (`original_bucket`,`original_key`);--> statement-breakpoint
CREATE INDEX `image_upload_jobs_product_status_idx` ON `image_upload_jobs` (`product_id`,`status`);--> statement-breakpoint
CREATE TABLE `image_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_id` text NOT NULL,
	`name` text NOT NULL,
	`bucket` text NOT NULL,
	`key` text NOT NULL,
	`public_url` text,
	`content_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`upload_id`) REFERENCES `image_upload_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `image_variants_upload_name_unique` ON `image_variants` (`upload_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `image_variants_bucket_key_unique` ON `image_variants` (`bucket`,`key`);--> statement-breakpoint
CREATE INDEX `image_variants_upload_idx` ON `image_variants` (`upload_id`);