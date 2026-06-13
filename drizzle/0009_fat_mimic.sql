CREATE TYPE "public"."appointment_request_status" AS ENUM('requested', 'scheduled', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."assessment_attempt_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."assessment_version_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."candidate_stage" AS ENUM('new', 'contacted', 'qualified', 'offer_pending', 'enrolled', 'lost');--> statement-breakpoint
CREATE TYPE "public"."inquiry_status" AS ENUM('open', 'completed', 'enrolled', 'closed');--> statement-breakpoint
CREATE TABLE "appointment_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	CONSTRAINT "appointment_preferences_rank_check" CHECK ("appointment_preferences"."rank" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "appointment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"assessment_result_id" uuid,
	"timezone" text NOT NULL,
	"status" "appointment_request_status" DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"continuation_token_hash" text NOT NULL,
	"status" "assessment_attempt_status" DEFAULT 'not_started' NOT NULL,
	"current_question_order" integer DEFAULT 1 NOT NULL,
	"score" integer,
	"result_level" text,
	"started_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"profile_completed_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_attempts_current_order_check" CHECK ("assessment_attempts"."current_question_order" >= 1)
);
--> statement-breakpoint
CREATE TABLE "assessment_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"label" jsonb NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"level" text NOT NULL,
	"topic" text NOT NULL,
	"difficulty" integer NOT NULL,
	"prompt" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_questions_order_check" CHECK ("assessment_questions"."order" >= 1),
	CONSTRAINT "assessment_questions_difficulty_check" CHECK ("assessment_questions"."difficulty" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "assessment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"correct_count" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"level" text NOT NULL,
	"level_breakdown" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_results_score_check" CHECK ("assessment_results"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "assessment_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "assessment_version_status" DEFAULT 'draft' NOT NULL,
	"title" jsonb NOT NULL,
	"question_count" integer NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_versions_question_count_check" CHECK ("assessment_versions"."question_count" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"language" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"inquiry_id" uuid,
	"type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"type" text NOT NULL,
	"version" text NOT NULL,
	"accepted" boolean NOT NULL,
	"locale" text NOT NULL,
	"text_snapshot" text NOT NULL,
	"masked_ip" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"language" text NOT NULL,
	"source" text DEFAULT 'public_level_test' NOT NULL,
	"locale" text NOT NULL,
	"status" "inquiry_status" DEFAULT 'open' NOT NULL,
	"form_version" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"referrer" text,
	"attribution" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"profile_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"advisor_id" text,
	"stage" "candidate_stage" DEFAULT 'new' NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone" text,
	"normalized_phone" text,
	"phone_owner" text,
	"is_minor" boolean DEFAULT false NOT NULL,
	"learning_goal" text,
	"preferred_contact_channel" text,
	"city" text,
	"timezone" text,
	"lesson_model" text,
	"contact_window" text,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_preferences" ADD CONSTRAINT "appointment_preferences_request_id_appointment_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."appointment_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_candidate_id_candidate_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_inquiry_id_candidate_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."candidate_inquiries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_assessment_result_id_assessment_results_id_fk" FOREIGN KEY ("assessment_result_id") REFERENCES "public"."assessment_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_attempt_id_assessment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."assessment_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_option_id_assessment_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."assessment_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_inquiry_id_candidate_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."candidate_inquiries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_version_id_assessment_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."assessment_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_options" ADD CONSTRAINT "assessment_options_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_version_id_assessment_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."assessment_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_attempt_id_assessment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."assessment_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_versions" ADD CONSTRAINT "assessment_versions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_activities" ADD CONSTRAINT "candidate_activities_candidate_id_candidate_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_activities" ADD CONSTRAINT "candidate_activities_inquiry_id_candidate_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."candidate_inquiries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_consents" ADD CONSTRAINT "candidate_consents_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_consents" ADD CONSTRAINT "candidate_consents_inquiry_id_candidate_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."candidate_inquiries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_inquiries" ADD CONSTRAINT "candidate_inquiries_candidate_id_candidate_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_preferences_request_rank_unique" ON "appointment_preferences" USING btree ("request_id","rank");--> statement-breakpoint
CREATE INDEX "appointment_preferences_starts_at_idx" ON "appointment_preferences" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "appointment_requests_candidate_created_idx" ON "appointment_requests" USING btree ("candidate_id","created_at");--> statement-breakpoint
CREATE INDEX "appointment_requests_status_idx" ON "appointment_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_answers_attempt_question_unique" ON "assessment_answers" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "assessment_answers_attempt_idx" ON "assessment_answers" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_attempts_continuation_token_unique" ON "assessment_attempts" USING btree ("continuation_token_hash");--> statement-breakpoint
CREATE INDEX "assessment_attempts_inquiry_created_idx" ON "assessment_attempts" USING btree ("inquiry_id","created_at");--> statement-breakpoint
CREATE INDEX "assessment_attempts_status_expiry_idx" ON "assessment_attempts" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_options_question_order_unique" ON "assessment_options" USING btree ("question_id","order");--> statement-breakpoint
CREATE INDEX "assessment_options_question_idx" ON "assessment_options" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_questions_version_order_unique" ON "assessment_questions" USING btree ("version_id","order");--> statement-breakpoint
CREATE INDEX "assessment_questions_version_level_idx" ON "assessment_questions" USING btree ("version_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_results_attempt_unique" ON "assessment_results" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_versions_assessment_version_unique" ON "assessment_versions" USING btree ("assessment_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_versions_one_published_idx" ON "assessment_versions" USING btree ("assessment_id") WHERE "assessment_versions"."status" = 'published';--> statement-breakpoint
CREATE INDEX "assessment_versions_status_idx" ON "assessment_versions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_slug_unique" ON "assessments" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "assessments_language_active_idx" ON "assessments" USING btree ("language","active");--> statement-breakpoint
CREATE INDEX "candidate_activities_candidate_occurred_idx" ON "candidate_activities" USING btree ("candidate_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_consents_inquiry_type_version_unique" ON "candidate_consents" USING btree ("inquiry_id","type","version");--> statement-breakpoint
CREATE INDEX "candidate_consents_contact_idx" ON "candidate_consents" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_inquiries_idempotency_unique" ON "candidate_inquiries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "candidate_inquiries_candidate_created_idx" ON "candidate_inquiries" USING btree ("candidate_id","created_at");--> statement-breakpoint
CREATE INDEX "candidate_inquiries_language_status_idx" ON "candidate_inquiries" USING btree ("language","status");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_profiles_contact_unique" ON "candidate_profiles" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "candidate_profiles_stage_activity_idx" ON "candidate_profiles" USING btree ("stage","last_activity_at");--> statement-breakpoint
CREATE INDEX "candidate_profiles_advisor_idx" ON "candidate_profiles" USING btree ("advisor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_normalized_email_unique" ON "contacts" USING btree ("normalized_email");--> statement-breakpoint
CREATE INDEX "contacts_normalized_phone_idx" ON "contacts" USING btree ("normalized_phone");--> statement-breakpoint
CREATE INDEX "contacts_created_idx" ON "contacts" USING btree ("created_at");--> statement-breakpoint
INSERT INTO "assessments" ("slug", "language", "active")
VALUES
  ('english-general-placement', 'english', true),
  ('german-general-placement', 'german', true),
  ('french-general-placement', 'french', true),
  ('arabic-general-placement', 'arabic', true);--> statement-breakpoint
INSERT INTO "assessment_versions" (
  "assessment_id", "version", "status", "title", "question_count", "published_at"
)
SELECT
  "id",
  1,
  'published',
  CASE "language"
    WHEN 'english' THEN '{"tr":"İngilizce Seviye Tespiti","en":"English Level Assessment"}'::jsonb
    WHEN 'german' THEN '{"tr":"Almanca Seviye Tespiti","en":"German Level Assessment"}'::jsonb
    WHEN 'french' THEN '{"tr":"Fransızca Seviye Tespiti","en":"French Level Assessment"}'::jsonb
    ELSE '{"tr":"Arapça Seviye Tespiti","en":"Arabic Level Assessment"}'::jsonb
  END,
  15,
  now()
FROM "assessments";--> statement-breakpoint
WITH language_labels AS (
  SELECT *
  FROM (
    VALUES
      ('english', 'İngilizce', 'English'),
      ('german', 'Almanca', 'German'),
      ('french', 'Fransızca', 'French'),
      ('arabic', 'Arapça', 'Arabic')
  ) AS labels("language", "tr_name", "en_name")
),
level_rows AS (
  SELECT *
  FROM (
    VALUES ('A1', 1), ('A2', 2), ('B1', 3), ('B2', 4), ('C1', 5)
  ) AS levels("level", "difficulty")
),
topic_rows AS (
  SELECT *
  FROM (
    VALUES
      ('grammar', 'dil bilgisi', 'grammar', 1),
      ('vocabulary', 'kelime bilgisi', 'vocabulary', 2),
      ('reading', 'okuduğunu anlama', 'reading', 3)
  ) AS topics("topic", "tr_topic", "en_topic", "topic_order")
)
INSERT INTO "assessment_questions" (
  "version_id", "order", "level", "topic", "difficulty", "prompt"
)
SELECT
  versions."id",
  ((levels."difficulty" - 1) * 3) + topics."topic_order",
  levels."level",
  topics."topic",
  levels."difficulty",
  jsonb_build_object(
    'tr',
    format(
      'Şu anda %s için %s seviyesinde, %s konusundaki sorudasınız.',
      labels."tr_name", levels."level", topics."tr_topic"
    ),
    'en',
    format(
      'You are now on the %s %s question about %s.',
      labels."en_name", levels."level", topics."en_topic"
    )
  )
FROM "assessment_versions" versions
JOIN "assessments" assessment
  ON assessment."id" = versions."assessment_id"
JOIN language_labels labels
  ON labels."language" = assessment."language"
CROSS JOIN level_rows levels
CROSS JOIN topic_rows topics;--> statement-breakpoint
INSERT INTO "assessment_options" (
  "question_id", "order", "label", "is_correct"
)
SELECT
  questions."id",
  options."option_order",
  CASE
    WHEN options."option_order" = ((questions."order" - 1) % 4) + 1
      THEN '{"tr":"Doğru cevap","en":"Correct answer"}'::jsonb
    ELSE jsonb_build_object(
      'tr', format('Yanlış cevap %s', options."option_order"),
      'en', format('Wrong answer %s', options."option_order")
    )
  END,
  options."option_order" = ((questions."order" - 1) % 4) + 1
FROM "assessment_questions" questions
CROSS JOIN generate_series(1, 4) AS options("option_order");--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "appointment_preferences", "appointment_requests",
      "assessment_answers", "assessment_attempts", "assessment_options",
      "assessment_questions", "assessment_results", "assessment_versions",
      "assessments", "candidate_activities", "candidate_consents",
      "candidate_inquiries", "candidate_profiles", "contacts"
    TO "zumra_app";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_backup') THEN
    GRANT SELECT ON
      "appointment_preferences", "appointment_requests",
      "assessment_answers", "assessment_attempts", "assessment_options",
      "assessment_questions", "assessment_results", "assessment_versions",
      "assessments", "candidate_activities", "candidate_consents",
      "candidate_inquiries", "candidate_profiles", "contacts"
    TO "zumra_backup";
  END IF;
END
$$;
