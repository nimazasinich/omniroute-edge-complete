-- Canonical V3.2: nullable observed usage/cost fields.
-- Legacy tokens_input/tokens_output/cost columns may contain default zero values and are not
-- considered authoritative by V3.2 analytics unless an upstream integration explicitly writes
-- the observed_* columns below.
ALTER TABLE `requests` ADD COLUMN `observed_tokens_input` integer;
--> statement-breakpoint
ALTER TABLE `requests` ADD COLUMN `observed_tokens_output` integer;
--> statement-breakpoint
ALTER TABLE `requests` ADD COLUMN `observed_cost` real;
