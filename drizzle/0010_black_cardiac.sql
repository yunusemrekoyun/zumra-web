CREATE TYPE "public"."course_mode" AS ENUM('group', 'private');--> statement-breakpoint
CREATE TYPE "public"."enrollment_document_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."enrollment_draft_status" AS ENUM('draft', 'review_required', 'ready', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."enrollment_party_relationship" AS ENUM('mother', 'father', 'sibling', 'other');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."gender_identity" AS ENUM('female', 'male', 'non_binary', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."identity_document_type" AS ENUM('national_id', 'passport');--> statement-breakpoint
CREATE TABLE "enrollment_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"status" "enrollment_document_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"created_by_user_id" text NOT NULL,
	"status" "enrollment_draft_status" DEFAULT 'draft' NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"identity_document_type" "identity_document_type",
	"identity_document_encrypted" text,
	"identity_document_blind_index" text,
	"identity_document_last_four" text,
	"first_name" text,
	"last_name" text,
	"birth_place" text,
	"birth_date" timestamp with time zone,
	"gender" "gender_identity",
	"school" text,
	"primary_phone" text,
	"secondary_phone" text,
	"email" text,
	"residence_address" text,
	"student_is_contract_party" boolean DEFAULT true NOT NULL,
	"instagram_handle" text,
	"course_mode" "course_mode",
	"program_reference_id" text,
	"program_selection" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"corrected_source" text,
	"registration_channel" text,
	"list_price_cents" integer,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"final_price_cents" integer,
	"initial_payment_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"payment_method" text,
	"installment_count" integer DEFAULT 1 NOT NULL,
	"financial_notes" text,
	"schedule_mode" text DEFAULT 'pending' NOT NULL,
	"schedule_preferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schedule_notes" text,
	"internal_notes" text,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"last_saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_drafts_current_step_check" CHECK ("enrollment_drafts"."current_step" between 1 and 9),
	CONSTRAINT "enrollment_drafts_currency_check" CHECK ("enrollment_drafts"."currency" = 'TRY'),
	CONSTRAINT "enrollment_drafts_money_non_negative_check" CHECK (coalesce("enrollment_drafts"."list_price_cents", 0) >= 0
        and "enrollment_drafts"."discount_cents" >= 0
        and coalesce("enrollment_drafts"."final_price_cents", 0) >= 0
        and "enrollment_drafts"."initial_payment_cents" >= 0),
	CONSTRAINT "enrollment_drafts_installment_count_check" CHECK ("enrollment_drafts"."installment_count" between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "enrollment_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"relationship" "enrollment_party_relationship" NOT NULL,
	"relationship_other" text,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"identity_document_type" "identity_document_type",
	"identity_document_encrypted" text,
	"identity_document_blind_index" text,
	"identity_document_last_four" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_parties_roles_not_empty_check" CHECK (jsonb_array_length("enrollment_parties"."roles") >= 1)
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"registered_by_user_id" text NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"course_mode" "course_mode" NOT NULL,
	"program_reference_id" text,
	"program_selection" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"final_price_cents" integer NOT NULL,
	"financial_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schedule_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_currency_check" CHECK ("enrollments"."currency" = 'TRY'),
	CONSTRAINT "enrollments_final_price_non_negative_check" CHECK ("enrollments"."final_price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"user_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"current_level" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrollment_documents" ADD CONSTRAINT "enrollment_documents_draft_id_enrollment_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."enrollment_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_documents" ADD CONSTRAINT "enrollment_documents_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_candidate_id_candidate_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_parties" ADD CONSTRAINT "enrollment_parties_draft_id_enrollment_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."enrollment_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_student_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_candidate_id_candidate_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_draft_id_enrollment_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."enrollment_drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_registered_by_user_id_users_id_fk" FOREIGN KEY ("registered_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_candidate_id_candidate_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_documents_draft_media_unique" ON "enrollment_documents" USING btree ("draft_id","media_asset_id");--> statement-breakpoint
CREATE INDEX "enrollment_documents_draft_type_idx" ON "enrollment_documents" USING btree ("draft_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_drafts_one_active_candidate_idx" ON "enrollment_drafts" USING btree ("candidate_id") WHERE "enrollment_drafts"."status" in ('draft', 'review_required', 'ready');--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_drafts_identity_blind_index_unique" ON "enrollment_drafts" USING btree ("identity_document_blind_index") WHERE "enrollment_drafts"."identity_document_blind_index" is not null;--> statement-breakpoint
CREATE INDEX "enrollment_drafts_status_saved_idx" ON "enrollment_drafts" USING btree ("status","last_saved_at");--> statement-breakpoint
CREATE INDEX "enrollment_drafts_created_by_idx" ON "enrollment_drafts" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "enrollment_parties_draft_idx" ON "enrollment_parties" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "enrollment_parties_identity_blind_idx" ON "enrollment_parties" USING btree ("identity_document_blind_index");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_draft_unique" ON "enrollments" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "enrollments_student_status_idx" ON "enrollments" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "enrollments_candidate_idx" ON "enrollments" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_profiles_candidate_unique" ON "student_profiles" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_profiles_contact_unique" ON "student_profiles" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_profiles_user_unique" ON "student_profiles" USING btree ("user_id") WHERE "student_profiles"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "student_profiles_status_idx" ON "student_profiles" USING btree ("status");--> statement-breakpoint
UPDATE "candidate_activities"
SET "type" = 'candidate.assessment_completed'
WHERE "type" = 'assessment.completed';--> statement-breakpoint
UPDATE "candidate_activities"
SET "type" = 'candidate.appointment_requested'
WHERE "type" = 'appointment.requested';--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "enrollment_documents", "enrollment_drafts", "enrollment_parties",
      "enrollments", "student_profiles"
    TO "zumra_app";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_backup') THEN
    GRANT SELECT ON
      "enrollment_documents", "enrollment_drafts", "enrollment_parties",
      "enrollments", "student_profiles"
    TO "zumra_backup";
  END IF;
END
$$;
