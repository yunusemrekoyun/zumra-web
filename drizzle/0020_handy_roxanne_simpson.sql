ALTER TYPE "public"."lesson_meeting_status" ADD VALUE 'dead';--> statement-breakpoint
ALTER TABLE "lesson_session_meetings" ADD COLUMN "next_retry_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "lesson_session_meetings_next_retry_idx" ON "lesson_session_meetings" USING btree ("next_retry_at");