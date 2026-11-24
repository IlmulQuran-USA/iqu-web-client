ALTER TABLE "outbox" DROP CONSTRAINT "outbox_status";--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_status" CHECK (status IN ('pending', 'sent', 'skipped', 'failed', 'dead'));