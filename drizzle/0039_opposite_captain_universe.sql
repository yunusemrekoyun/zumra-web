CREATE TYPE "public"."lesson_change_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."lesson_change_request_type" AS ENUM('cancel', 'postpone');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'lesson_change_requested';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'lesson_change_request_decided';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'lesson_session_changed';--> statement-breakpoint
CREATE TABLE "lesson_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_session_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"type" "lesson_change_request_type" NOT NULL,
	"requested_starts_at" timestamp with time zone,
	"note" text,
	"status" "lesson_change_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by_user_id" text,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_change_requests_requested_time_check" CHECK ("lesson_change_requests"."requested_starts_at" is null or "lesson_change_requests"."type" = 'postpone')
);
--> statement-breakpoint
ALTER TABLE "lesson_change_requests" ADD CONSTRAINT "lesson_change_requests_lesson_session_id_lesson_sessions_id_fk" FOREIGN KEY ("lesson_session_id") REFERENCES "public"."lesson_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_change_requests" ADD CONSTRAINT "lesson_change_requests_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_change_requests" ADD CONSTRAINT "lesson_change_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_change_requests_open_unique" ON "lesson_change_requests" USING btree ("lesson_session_id","student_profile_id") WHERE "lesson_change_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "lesson_change_requests_status_idx" ON "lesson_change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lesson_change_requests_student_idx" ON "lesson_change_requests" USING btree ("student_profile_id");