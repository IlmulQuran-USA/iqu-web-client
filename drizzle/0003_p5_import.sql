CREATE TABLE "wp_import_rows" (
	"source_table" text NOT NULL,
	"source_key" text NOT NULL,
	"target_table" text NOT NULL,
	"target_key" text NOT NULL,
	"source_hash" char(64) NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wp_import_rows_source_table_source_key_pk" PRIMARY KEY("source_table","source_key")
);
--> statement-breakpoint
ALTER TABLE "arrears" DROP CONSTRAINT "arrears_status";--> statement-breakpoint
CREATE UNIQUE INDEX "wp_import_rows_target_uq" ON "wp_import_rows" USING btree ("target_table","target_key");--> statement-breakpoint
ALTER TABLE "arrears" ADD CONSTRAINT "arrears_status" CHECK (status IN ('open', 'scheduled', 'charged', 'waived', 'escalated', 'stopped'));