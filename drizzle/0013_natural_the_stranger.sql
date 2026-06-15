CREATE TYPE "public"."instructor_document_kind" AS ENUM('certificate', 'identity', 'contract', 'other');--> statement-breakpoint
CREATE TYPE "public"."instructor_status" AS ENUM('draft', 'active', 'on_leave', 'inactive', 'archived');--> statement-breakpoint
CREATE TABLE "instructor_account_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instructor_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"kind" "instructor_document_kind" DEFAULT 'other' NOT NULL,
	"label" text NOT NULL,
	"notes" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instructor_language_competencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"language" text NOT NULL,
	"levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instructor_languages_levels_check" CHECK (jsonb_array_length("instructor_language_competencies"."levels") >= 1)
);
--> statement-breakpoint
CREATE TABLE "instructor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"status" "instructor_status" DEFAULT 'draft' NOT NULL,
	"biography" text,
	"specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"internal_notes" text,
	"photo_media_asset_id" uuid,
	"archived_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instructor_profiles_name_check" CHECK (length(trim("instructor_profiles"."first_name")) >= 2
        and length(trim("instructor_profiles"."last_name")) >= 2),
	CONSTRAINT "instructor_profiles_phone_check" CHECK (length(trim("instructor_profiles"."phone")) >= 7)
);
--> statement-breakpoint
ALTER TABLE "enrollment_drafts" DROP CONSTRAINT "enrollment_drafts_private_lesson_fields_check";--> statement-breakpoint
ALTER TABLE "enrollment_drafts" DROP CONSTRAINT "enrollment_drafts_selected_teacher_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_selected_teacher_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "private_lesson_student_rates" DROP CONSTRAINT "private_lesson_student_rates_teacher_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "program_branches" DROP CONSTRAINT "program_branches_teacher_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "enrollment_drafts_teacher_idx";--> statement-breakpoint
DROP INDEX "enrollments_teacher_idx";--> statement-breakpoint
DROP INDEX "private_lesson_rates_one_current_teacher_language_idx";--> statement-breakpoint
DROP INDEX "program_branches_teacher_idx";--> statement-breakpoint
DROP INDEX "private_lesson_rates_lookup_idx";--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "selected_instructor_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "selected_instructor_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "private_lesson_student_rates" ADD COLUMN "instructor_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "program_branches" ADD COLUMN "instructor_profile_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "instructor_profiles_user_unique" ON "instructor_profiles" USING btree ("user_id") WHERE "instructor_profiles"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "instructor_profiles_email_unique" ON "instructor_profiles" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "instructor_languages_instructor_language_unique" ON "instructor_language_competencies" USING btree ("instructor_id","language");--> statement-breakpoint
INSERT INTO "instructor_profiles" (
	"user_id",
	"first_name",
	"last_name",
	"email",
	"phone",
	"status",
	"created_by_user_id"
)
SELECT
	"id",
	CASE
		WHEN length(trim(split_part("name", ' ', 1))) >= 2
			THEN trim(split_part("name", ' ', 1))
		ELSE 'Unknown'
	END,
	CASE
		WHEN length(trim(substring(trim("name") from position(' ' in trim("name")) + 1))) >= 2
			THEN trim(substring(trim("name") from position(' ' in trim("name")) + 1))
		ELSE 'Unknown'
	END,
	lower("email"),
	'0000000',
	CASE
		WHEN "account_status" = 'active' THEN 'active'::"instructor_status"
		ELSE 'inactive'::"instructor_status"
	END,
	"id"
FROM "users"
WHERE "role" = 'teacher'
ON CONFLICT ("email") DO NOTHING;--> statement-breakpoint
INSERT INTO "instructor_language_competencies" (
	"instructor_id",
	"language",
	"levels"
)
SELECT DISTINCT
	"profile"."id",
	"rate"."language",
	'["A1","A2","B1","B2","C1","C2"]'::jsonb
FROM "private_lesson_student_rates" "rate"
INNER JOIN "instructor_profiles" "profile"
	ON "profile"."user_id" = "rate"."teacher_user_id"
ON CONFLICT ("instructor_id", "language") DO NOTHING;--> statement-breakpoint
INSERT INTO "instructor_language_competencies" (
	"instructor_id",
	"language",
	"levels"
)
SELECT DISTINCT
	"profile"."id",
	"program"."language",
	"program"."levels"
FROM "program_branches" "branch"
INNER JOIN "instructor_profiles" "profile"
	ON "profile"."user_id" = "branch"."teacher_user_id"
INNER JOIN "programs" "program"
	ON "program"."id" = "branch"."program_id"
WHERE "program"."language" IS NOT NULL
	AND jsonb_array_length("program"."levels") >= 1
ON CONFLICT ("instructor_id", "language") DO NOTHING;--> statement-breakpoint
UPDATE "program_branches" "branch"
SET "instructor_profile_id" = "profile"."id"
FROM "instructor_profiles" "profile"
WHERE "profile"."user_id" = "branch"."teacher_user_id";--> statement-breakpoint
UPDATE "private_lesson_student_rates" "rate"
SET "instructor_profile_id" = "profile"."id"
FROM "instructor_profiles" "profile"
WHERE "profile"."user_id" = "rate"."teacher_user_id";--> statement-breakpoint
UPDATE "enrollment_drafts" "draft"
SET "selected_instructor_profile_id" = "profile"."id"
FROM "instructor_profiles" "profile"
WHERE "profile"."user_id" = "draft"."selected_teacher_user_id";--> statement-breakpoint
UPDATE "enrollments" "enrollment"
SET "selected_instructor_profile_id" = "profile"."id"
FROM "instructor_profiles" "profile"
WHERE "profile"."user_id" = "enrollment"."selected_teacher_user_id";--> statement-breakpoint
ALTER TABLE "private_lesson_student_rates" ALTER COLUMN "instructor_profile_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "instructor_account_invitations" ADD CONSTRAINT "instructor_account_invitations_instructor_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_account_invitations" ADD CONSTRAINT "instructor_account_invitations_invitation_id_user_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."user_invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_documents" ADD CONSTRAINT "instructor_documents_instructor_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_documents" ADD CONSTRAINT "instructor_documents_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_documents" ADD CONSTRAINT "instructor_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_language_competencies" ADD CONSTRAINT "instructor_language_competencies_instructor_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_profiles" ADD CONSTRAINT "instructor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_profiles" ADD CONSTRAINT "instructor_profiles_photo_media_asset_id_media_assets_id_fk" FOREIGN KEY ("photo_media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_profiles" ADD CONSTRAINT "instructor_profiles_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instructor_account_invitation_unique" ON "instructor_account_invitations" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "instructor_account_instructor_idx" ON "instructor_account_invitations" USING btree ("instructor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instructor_documents_media_unique" ON "instructor_documents" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "instructor_documents_instructor_idx" ON "instructor_documents" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "instructor_languages_language_idx" ON "instructor_language_competencies" USING btree ("language");--> statement-breakpoint
CREATE INDEX "instructor_profiles_status_name_idx" ON "instructor_profiles" USING btree ("status","last_name","first_name");--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_selected_instructor_profile_id_instructor_profiles_id_fk" FOREIGN KEY ("selected_instructor_profile_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_selected_instructor_profile_id_instructor_profiles_id_fk" FOREIGN KEY ("selected_instructor_profile_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_lesson_student_rates" ADD CONSTRAINT "private_lesson_student_rates_instructor_profile_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_profile_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_branches" ADD CONSTRAINT "program_branches_instructor_profile_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_profile_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrollment_drafts_instructor_idx" ON "enrollment_drafts" USING btree ("selected_instructor_profile_id");--> statement-breakpoint
CREATE INDEX "enrollments_instructor_idx" ON "enrollments" USING btree ("selected_instructor_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "private_lesson_rates_one_current_instructor_language_idx" ON "private_lesson_student_rates" USING btree ("instructor_profile_id","language") WHERE "private_lesson_student_rates"."active" = true and "private_lesson_student_rates"."effective_until" is null;--> statement-breakpoint
CREATE INDEX "program_branches_instructor_idx" ON "program_branches" USING btree ("instructor_profile_id");--> statement-breakpoint
CREATE INDEX "private_lesson_rates_lookup_idx" ON "private_lesson_student_rates" USING btree ("instructor_profile_id","language","active");--> statement-breakpoint
ALTER TABLE "enrollment_drafts" DROP COLUMN "selected_teacher_user_id";--> statement-breakpoint
ALTER TABLE "enrollments" DROP COLUMN "selected_teacher_user_id";--> statement-breakpoint
ALTER TABLE "private_lesson_student_rates" DROP COLUMN "teacher_user_id";--> statement-breakpoint
ALTER TABLE "program_branches" DROP COLUMN "teacher_user_id";--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_private_lesson_fields_check" CHECK ("enrollment_drafts"."course_mode" <> 'private'
        or "enrollment_drafts"."program_id" is null
        or (
          "enrollment_drafts"."selected_instructor_profile_id" is not null
          and "enrollment_drafts"."private_lesson_language" is not null
          and "enrollment_drafts"."private_lesson_hours" > 0
          and "enrollment_drafts"."private_lesson_rate_id" is not null
        )); 
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "instructor_profiles",
      "instructor_language_competencies",
      "instructor_documents",
      "instructor_account_invitations"
    TO "zumra_app";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_backup') THEN
    GRANT SELECT ON
      "instructor_profiles",
      "instructor_language_competencies",
      "instructor_documents",
      "instructor_account_invitations"
    TO "zumra_backup";
  END IF;
END
$$;
