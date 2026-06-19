CREATE TYPE "public"."lesson_absence_report_status" AS ENUM('submitted', 'acknowledged', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."lesson_attendance_source" AS ENUM('google_meet', 'student_report', 'system', 'teacher');--> statement-breakpoint
CREATE TYPE "public"."lesson_attendance_status" AS ENUM('pending', 'present', 'late', 'absent', 'excused', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."lesson_meeting_provider" AS ENUM('google_meet');--> statement-breakpoint
CREATE TYPE "public"."lesson_meeting_status" AS ENUM('pending', 'creating', 'ready', 'failed', 'disabled');--> statement-breakpoint
CREATE TABLE "lesson_absence_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_session_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"status" "lesson_absence_report_status" DEFAULT 'submitted' NOT NULL,
	"reason" text,
	"note" text,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_attendance_participant_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_session_id" uuid NOT NULL,
	"attendance_record_id" uuid,
	"matched_student_profile_id" uuid,
	"google_conference_record_name" text NOT NULL,
	"google_participant_name" text NOT NULL,
	"google_participant_session_name" text NOT NULL,
	"google_user" text,
	"display_name" text NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"match_confidence" text DEFAULT 'unmatched' NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_attendance_participant_session_duration_check" CHECK ("lesson_attendance_participant_sessions"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lesson_attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_session_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"status" "lesson_attendance_status" DEFAULT 'needs_review' NOT NULL,
	"suggested_status" "lesson_attendance_status",
	"source" "lesson_attendance_source" DEFAULT 'system' NOT NULL,
	"total_seconds" integer DEFAULT 0 NOT NULL,
	"first_joined_at" timestamp with time zone,
	"last_left_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_user_id" text,
	"teacher_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_attendance_records_duration_check" CHECK ("lesson_attendance_records"."total_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lesson_session_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_session_id" uuid NOT NULL,
	"provider" "lesson_meeting_provider" DEFAULT 'google_meet' NOT NULL,
	"status" "lesson_meeting_status" DEFAULT 'pending' NOT NULL,
	"space_name" text,
	"meeting_uri" text,
	"meeting_code" text,
	"organizer_email" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_synced_at" timestamp with time zone,
	"next_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_session_meetings_ready_check" CHECK ("lesson_session_meetings"."status" <> 'ready'
        or (
          "lesson_session_meetings"."space_name" is not null
          and "lesson_session_meetings"."meeting_uri" is not null
          and "lesson_session_meetings"."meeting_code" is not null
        ))
);
--> statement-breakpoint
ALTER TABLE "external_identities" ADD COLUMN "meet_user_id" text;--> statement-breakpoint
ALTER TABLE "lesson_absence_reports" ADD CONSTRAINT "lesson_absence_reports_lesson_session_id_lesson_sessions_id_fk" FOREIGN KEY ("lesson_session_id") REFERENCES "public"."lesson_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_absence_reports" ADD CONSTRAINT "lesson_absence_reports_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attendance_participant_sessions" ADD CONSTRAINT "lesson_attendance_participant_sessions_lesson_session_id_lesson_sessions_id_fk" FOREIGN KEY ("lesson_session_id") REFERENCES "public"."lesson_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attendance_participant_sessions" ADD CONSTRAINT "lesson_attendance_participant_sessions_attendance_record_id_lesson_attendance_records_id_fk" FOREIGN KEY ("attendance_record_id") REFERENCES "public"."lesson_attendance_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attendance_participant_sessions" ADD CONSTRAINT "lesson_attendance_participant_sessions_matched_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("matched_student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attendance_records" ADD CONSTRAINT "lesson_attendance_records_lesson_session_id_lesson_sessions_id_fk" FOREIGN KEY ("lesson_session_id") REFERENCES "public"."lesson_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attendance_records" ADD CONSTRAINT "lesson_attendance_records_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attendance_records" ADD CONSTRAINT "lesson_attendance_records_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_session_meetings" ADD CONSTRAINT "lesson_session_meetings_lesson_session_id_lesson_sessions_id_fk" FOREIGN KEY ("lesson_session_id") REFERENCES "public"."lesson_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_absence_reports_session_student_unique" ON "lesson_absence_reports" USING btree ("lesson_session_id","student_profile_id");--> statement-breakpoint
CREATE INDEX "lesson_absence_reports_status_idx" ON "lesson_absence_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lesson_absence_reports_student_idx" ON "lesson_absence_reports" USING btree ("student_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_attendance_participant_session_unique" ON "lesson_attendance_participant_sessions" USING btree ("google_participant_session_name");--> statement-breakpoint
CREATE INDEX "lesson_attendance_participant_session_lesson_idx" ON "lesson_attendance_participant_sessions" USING btree ("lesson_session_id");--> statement-breakpoint
CREATE INDEX "lesson_attendance_participant_session_google_user_idx" ON "lesson_attendance_participant_sessions" USING btree ("google_user");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_attendance_records_session_student_unique" ON "lesson_attendance_records" USING btree ("lesson_session_id","student_profile_id");--> statement-breakpoint
CREATE INDEX "lesson_attendance_records_status_idx" ON "lesson_attendance_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lesson_attendance_records_student_idx" ON "lesson_attendance_records" USING btree ("student_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_session_meetings_session_unique" ON "lesson_session_meetings" USING btree ("lesson_session_id");--> statement-breakpoint
CREATE INDEX "lesson_session_meetings_status_idx" ON "lesson_session_meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lesson_session_meetings_next_sync_idx" ON "lesson_session_meetings" USING btree ("next_sync_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_identities_meet_user_unique" ON "external_identities" USING btree ("meet_user_id") WHERE "external_identities"."meet_user_id" is not null;