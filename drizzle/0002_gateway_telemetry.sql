-- Canonical V3: add thin edge gateway telemetry columns to the request read model.
ALTER TABLE `requests` ADD COLUMN `path` text;
--> statement-breakpoint
ALTER TABLE `requests` ADD COLUMN `correlation_id` text;
--> statement-breakpoint
ALTER TABLE `requests` ADD COLUMN `status_code` integer;
--> statement-breakpoint
ALTER TABLE `requests` ADD COLUMN `error` text;
--> statement-breakpoint
ALTER TABLE `requests` ADD COLUMN `streaming` integer DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_requests_correlation_id` ON `requests` (`correlation_id`);
