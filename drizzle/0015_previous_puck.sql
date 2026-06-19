CREATE TYPE "public"."lesson_schedule_mode" AS ENUM('weekly', 'manual');--> statement-breakpoint
CREATE TYPE "public"."lesson_session_source" AS ENUM('branch', 'private');--> statement-breakpoint
CREATE TYPE "public"."lesson_session_status" AS ENUM('scheduled', 'cancelled', 'postponed', 'completed');--> statement-breakpoint
CREATE TABLE "branch_lesson_schedule_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"mode" "lesson_schedule_mode" NOT NULL,
	"weekday" integer,
	"start_time" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_lesson_schedule_rules_weekday_check" CHECK ("branch_lesson_schedule_rules"."weekday" is null or "branch_lesson_schedule_rules"."weekday" between 1 and 7),
	CONSTRAINT "branch_lesson_schedule_rules_weekly_check" CHECK ("branch_lesson_schedule_rules"."mode" <> 'weekly'
        or (
          "branch_lesson_schedule_rules"."weekday" is not null
          and "branch_lesson_schedule_rules"."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        ))
);
--> statement-breakpoint
CREATE TABLE "lesson_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "lesson_session_source" NOT NULL,
	"branch_schedule_rule_id" uuid,
	"branch_id" uuid,
	"enrollment_id" uuid,
	"instructor_profile_id" uuid,
	"student_profile_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'Europe/Istanbul' NOT NULL,
	"status" "lesson_session_status" DEFAULT 'scheduled' NOT NULL,
	"original_starts_at" timestamp with time zone,
	"change_note" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_sessions_target_check" CHECK (("lesson_sessions"."source" = 'branch' and "lesson_sessions"."branch_id" is not null)
        or ("lesson_sessions"."source" = 'private' and "lesson_sessions"."enrollment_id" is not null)),
	CONSTRAINT "lesson_sessions_period_check" CHECK ("lesson_sessions"."ends_at" > "lesson_sessions"."starts_at"),
	CONSTRAINT "lesson_sessions_timezone_check" CHECK (length(trim("lesson_sessions"."timezone")) > 0)
);
--> statement-breakpoint
ALTER TABLE "branch_lesson_schedule_rules" ADD CONSTRAINT "branch_lesson_schedule_rules_branch_id_program_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."program_branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_lesson_schedule_rules" ADD CONSTRAINT "branch_lesson_schedule_rules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_branch_schedule_rule_id_branch_lesson_schedule_rules_id_fk" FOREIGN KEY ("branch_schedule_rule_id") REFERENCES "public"."branch_lesson_schedule_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_branch_id_program_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."program_branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_instructor_profile_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_profile_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_lesson_schedule_rules_branch_unique" ON "branch_lesson_schedule_rules" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "branch_lesson_schedule_rules_mode_idx" ON "branch_lesson_schedule_rules" USING btree ("mode");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_sessions_branch_starts_unique" ON "lesson_sessions" USING btree ("branch_id","starts_at") WHERE "lesson_sessions"."branch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_sessions_enrollment_starts_unique" ON "lesson_sessions" USING btree ("enrollment_id","starts_at") WHERE "lesson_sessions"."enrollment_id" is not null;--> statement-breakpoint
CREATE INDEX "lesson_sessions_instructor_starts_idx" ON "lesson_sessions" USING btree ("instructor_profile_id","starts_at");--> statement-breakpoint
CREATE INDEX "lesson_sessions_student_starts_idx" ON "lesson_sessions" USING btree ("student_profile_id","starts_at");--> statement-breakpoint
CREATE INDEX "lesson_sessions_branch_idx" ON "lesson_sessions" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "lesson_sessions_status_starts_idx" ON "lesson_sessions" USING btree ("status","starts_at");--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "branch_lesson_schedule_rules", "lesson_sessions"
    TO "zumra_app";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_backup') THEN
    GRANT SELECT ON
      "branch_lesson_schedule_rules", "lesson_sessions"
    TO "zumra_backup";
  END IF;
END
$$;
