CREATE TABLE IF NOT EXISTS `routing_decision_index` (
  `request_id` text PRIMARY KEY NOT NULL,
  `correlation_id` text,
  `outcome_observed_at` integer,
  `requested_model` text,
  `provider_id` text,
  `connection_id` text,
  `model_id` text,
  `combo_id` text,
  `combo_step_id` text,
  `combo_execution_key` text,
  `status_code` integer,
  `duration_ms` integer,
  `source` text DEFAULT 'omniroute-call-log' NOT NULL,
  `ingested_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_routing_decision_correlation` ON `routing_decision_index` (`correlation_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_routing_decision_observed_at` ON `routing_decision_index` (`outcome_observed_at`);
