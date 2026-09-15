-- Browser admin authentication for DreamWorker/Secure-AI-Router UI.
-- This is intentionally separate from gateway/admin API-key authentication.
CREATE TABLE IF NOT EXISTS `auth_users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL UNIQUE,
  `display_name` text DEFAULT 'Administrator' NOT NULL,
  `password_hash` text,
  `role` text DEFAULT 'admin' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `oauth_provider` text,
  `oauth_subject` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `last_login_at` integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `auth_users`(`id`) ON DELETE CASCADE,
  `token_hash` text NOT NULL UNIQUE,
  `csrf_hash` text NOT NULL,
  `created_at` integer NOT NULL,
  `last_seen_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `user_agent` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_auth_sessions_user` ON `auth_sessions` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_auth_sessions_expires` ON `auth_sessions` (`expires_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `auth_login_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `email_hash` text NOT NULL,
  `attempted_at` integer NOT NULL,
  `success` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_auth_login_attempts_email_time` ON `auth_login_attempts` (`email_hash`, `attempted_at`);
