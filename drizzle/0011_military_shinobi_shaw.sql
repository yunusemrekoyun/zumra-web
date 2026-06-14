CREATE TYPE "public"."discount_type" AS ENUM('none', 'percentage', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."program_kind" AS ENUM('group', 'private');--> statement-breakpoint
CREATE TABLE "private_lesson_student_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_user_id" text NOT NULL,
	"language" text NOT NULL,
	"hourly_price_cents" integer NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "private_lesson_rates_price_positive_check" CHECK ("private_lesson_student_rates"."hourly_price_cents" > 0),
	CONSTRAINT "private_lesson_rates_currency_check" CHECK ("private_lesson_student_rates"."currency" = 'TRY'),
	CONSTRAINT "private_lesson_rates_period_check" CHECK ("private_lesson_student_rates"."effective_until" is null
        or "private_lesson_student_rates"."effective_until" > "private_lesson_student_rates"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_key" text,
	"name" text NOT NULL,
	"description" text,
	"kind" "program_kind" DEFAULT 'group' NOT NULL,
	"language" text,
	"levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"list_price_cents" integer,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"system_managed" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programs_currency_check" CHECK ("programs"."currency" = 'TRY'),
	CONSTRAINT "programs_list_price_non_negative_check" CHECK ("programs"."list_price_cents" is null or "programs"."list_price_cents" >= 0),
	CONSTRAINT "programs_group_fields_check" CHECK ("programs"."kind" <> 'group'
        or (
          "programs"."language" is not null
          and "programs"."list_price_cents" is not null
          and jsonb_array_length("programs"."levels") >= 1
        )),
	CONSTRAINT "programs_creator_check" CHECK ("programs"."system_managed" = true or "programs"."created_by_user_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "enrollment_drafts" DROP CONSTRAINT "enrollment_drafts_money_non_negative_check";--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "program_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "selected_teacher_user_id" text;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "private_lesson_language" text;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "private_lesson_hours" integer;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "private_lesson_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "discount_type" "discount_type" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "discount_value" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "discount_applied_by_user_id" text;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "discount_note" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "program_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "selected_teacher_user_id" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "private_lesson_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "private_lesson_student_rates" ADD CONSTRAINT "private_lesson_student_rates_teacher_user_id_users_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_lesson_student_rates" ADD CONSTRAINT "private_lesson_student_rates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "private_lesson_rates_one_current_teacher_language_idx" ON "private_lesson_student_rates" USING btree ("teacher_user_id","language") WHERE "private_lesson_student_rates"."active" = true and "private_lesson_student_rates"."effective_until" is null;--> statement-breakpoint
CREATE INDEX "private_lesson_rates_lookup_idx" ON "private_lesson_student_rates" USING btree ("teacher_user_id","language","active");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_system_key_unique" ON "programs" USING btree ("system_key") WHERE "programs"."system_key" is not null;--> statement-breakpoint
CREATE INDEX "programs_active_kind_idx" ON "programs" USING btree ("active","kind");--> statement-breakpoint
CREATE INDEX "programs_language_idx" ON "programs" USING btree ("language");--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_selected_teacher_user_id_users_id_fk" FOREIGN KEY ("selected_teacher_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_private_lesson_rate_id_private_lesson_student_rates_id_fk" FOREIGN KEY ("private_lesson_rate_id") REFERENCES "public"."private_lesson_student_rates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_discount_applied_by_user_id_users_id_fk" FOREIGN KEY ("discount_applied_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_selected_teacher_user_id_users_id_fk" FOREIGN KEY ("selected_teacher_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_private_lesson_rate_id_private_lesson_student_rates_id_fk" FOREIGN KEY ("private_lesson_rate_id") REFERENCES "public"."private_lesson_student_rates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrollment_drafts_program_idx" ON "enrollment_drafts" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "enrollment_drafts_teacher_idx" ON "enrollment_drafts" USING btree ("selected_teacher_user_id");--> statement-breakpoint
CREATE INDEX "enrollments_program_idx" ON "enrollments" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "enrollments_teacher_idx" ON "enrollments" USING btree ("selected_teacher_user_id");--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_discount_value_check" CHECK (("enrollment_drafts"."discount_type" = 'percentage' and "enrollment_drafts"."discount_value" <= 10000)
        or "enrollment_drafts"."discount_type" <> 'percentage');--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_private_lesson_fields_check" CHECK ("enrollment_drafts"."course_mode" <> 'private'
        or "enrollment_drafts"."program_id" is null
        or (
          "enrollment_drafts"."selected_teacher_user_id" is not null
          and "enrollment_drafts"."private_lesson_language" is not null
          and "enrollment_drafts"."private_lesson_hours" > 0
          and "enrollment_drafts"."private_lesson_rate_id" is not null
        ));--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_money_non_negative_check" CHECK (coalesce("enrollment_drafts"."list_price_cents", 0) >= 0
        and "enrollment_drafts"."discount_value" >= 0
        and "enrollment_drafts"."discount_cents" >= 0
        and coalesce("enrollment_drafts"."final_price_cents", 0) >= 0
        and "enrollment_drafts"."initial_payment_cents" >= 0);--> statement-breakpoint
INSERT INTO "programs" (
  "id",
  "system_key",
  "name",
  "description",
  "kind",
  "levels",
  "currency",
  "active",
  "system_managed"
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'private-lesson',
  'Özel Ders',
  'Eğitmen, dil ve satın alınan saate göre fiyatlanan sistem programı.',
  'private',
  '[]'::jsonb,
  'TRY',
  true,
  true
)
ON CONFLICT DO NOTHING;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "programs", "private_lesson_student_rates"
    TO "zumra_app";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_backup') THEN
    GRANT SELECT ON
      "programs", "private_lesson_student_rates"
    TO "zumra_backup";
  END IF;
END
$$;
