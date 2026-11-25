CREATE TABLE "eligibility_blocks" (
	"hour" timestamp with time zone NOT NULL,
	"mode" text NOT NULL,
	"country" char(2) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "eligibility_blocks_hour_mode_country_pk" PRIMARY KEY("hour","mode","country"),
	CONSTRAINT "eligibility_blocks_mode" CHECK (mode IN ('monitor', 'enforce')),
	CONSTRAINT "eligibility_blocks_country" CHECK ("eligibility_blocks"."country" ~ '^([A-Z]{2}|\?\?)$'),
	CONSTRAINT "eligibility_blocks_hour" CHECK (date_trunc('hour', "eligibility_blocks"."hour") = "eligibility_blocks"."hour"),
	CONSTRAINT "eligibility_blocks_count" CHECK ("eligibility_blocks"."count" > 0)
);
--> statement-breakpoint
ALTER TABLE "registrations" DROP CONSTRAINT "registrations_fund_needs_fee";