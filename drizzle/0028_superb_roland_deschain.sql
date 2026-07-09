ALTER TABLE "appointment_requests" ADD COLUMN "scheduled_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD COLUMN "outcome_note" text;