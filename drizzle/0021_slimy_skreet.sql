CREATE TYPE "public"."assignment_submission_status" AS ENUM('submitted', 'graded');--> statement-breakpoint
CREATE TYPE "public"."assignment_target_type" AS ENUM('student', 'branch');--> statement-breakpoint
CREATE TABLE "assignment_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_submission_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"body" text,
	"status" "assignment_submission_status" DEFAULT 'submitted' NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"score" integer,
	"feedback" text,
	"graded_at" timestamp with time zone,
	"graded_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_submissions_score_check" CHECK ("assignment_submissions"."score" is null or "assignment_submissions"."score" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_profile_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"requires_submission" boolean DEFAULT true NOT NULL,
	"max_score" integer,
	"due_at" timestamp with time zone,
	"target_type" "assignment_target_type" NOT NULL,
	"target_branch_id" uuid,
	"target_enrollment_id" uuid,
	"lesson_session_id" uuid,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_target_check" CHECK (("assignments"."target_type" = 'branch' and "assignments"."target_branch_id" is not null and "assignments"."target_enrollment_id" is null)
        or ("assignments"."target_type" = 'student' and "assignments"."target_enrollment_id" is not null and "assignments"."target_branch_id" is null)),
	CONSTRAINT "assignments_max_score_check" CHECK ("assignments"."max_score" is null or "assignments"."max_score" > 0)
);
--> statement-breakpoint
ALTER TABLE "assignment_attachments" ADD CONSTRAINT "assignment_attachments_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_attachments" ADD CONSTRAINT "assignment_attachments_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submission_attachments" ADD CONSTRAINT "assignment_submission_attachments_submission_id_assignment_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submission_attachments" ADD CONSTRAINT "assignment_submission_attachments_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_graded_by_user_id_users_id_fk" FOREIGN KEY ("graded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_instructor_profile_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_profile_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_target_branch_id_program_branches_id_fk" FOREIGN KEY ("target_branch_id") REFERENCES "public"."program_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_target_enrollment_id_enrollments_id_fk" FOREIGN KEY ("target_enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lesson_session_id_lesson_sessions_id_fk" FOREIGN KEY ("lesson_session_id") REFERENCES "public"."lesson_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_attachments_unique" ON "assignment_attachments" USING btree ("assignment_id","media_asset_id");--> statement-breakpoint
CREATE INDEX "assignment_attachments_assignment_idx" ON "assignment_attachments" USING btree ("assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_submission_attachments_unique" ON "assignment_submission_attachments" USING btree ("submission_id","media_asset_id");--> statement-breakpoint
CREATE INDEX "assignment_submission_attachments_submission_idx" ON "assignment_submission_attachments" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_submissions_assignment_student_unique" ON "assignment_submissions" USING btree ("assignment_id","student_profile_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_student_idx" ON "assignment_submissions" USING btree ("student_profile_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_status_idx" ON "assignment_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assignments_instructor_idx" ON "assignments" USING btree ("instructor_profile_id");--> statement-breakpoint
CREATE INDEX "assignments_branch_idx" ON "assignments" USING btree ("target_branch_id");--> statement-breakpoint
CREATE INDEX "assignments_enrollment_idx" ON "assignments" USING btree ("target_enrollment_id");--> statement-breakpoint
CREATE INDEX "assignments_lesson_session_idx" ON "assignments" USING btree ("lesson_session_id");