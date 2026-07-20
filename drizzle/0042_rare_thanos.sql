CREATE TYPE "public"."discovery_fee_scope" AS ENUM('branch', 'instructor');--> statement-breakpoint
CREATE TYPE "public"."discovery_lesson_status" AS ENUM('scheduled', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."discovery_payment_status" AS ENUM('free', 'awaiting', 'reported', 'received');--> statement-breakpoint
CREATE TABLE "discovery_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "discovery_fee_scope" NOT NULL,
	"branch_id" uuid,
	"instructor_profile_id" uuid,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_fees_target_check" CHECK (("discovery_fees"."scope" = 'branch' and "discovery_fees"."branch_id" is not null and "discovery_fees"."instructor_profile_id" is null)
        or ("discovery_fees"."scope" = 'instructor' and "discovery_fees"."instructor_profile_id" is not null and "discovery_fees"."branch_id" is null)),
	CONSTRAINT "discovery_fees_fee_check" CHECK ("discovery_fees"."fee_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "discovery_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"instructor_profile_id" uuid NOT NULL,
	"branch_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"status" "discovery_lesson_status" DEFAULT 'scheduled' NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"payment_status" "discovery_payment_status" DEFAULT 'free' NOT NULL,
	"note" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_lessons_duration_check" CHECK ("discovery_lessons"."duration_minutes" between 15 and 180),
	CONSTRAINT "discovery_lessons_fee_check" CHECK ("discovery_lessons"."fee_cents" >= 0),
	CONSTRAINT "discovery_lessons_payment_check" CHECK (("discovery_lessons"."fee_cents" = 0 and "discovery_lessons"."payment_status" = 'free')
        or ("discovery_lessons"."fee_cents" > 0 and "discovery_lessons"."payment_status" <> 'free'))
);
--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "demo_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discovery_fees" ADD CONSTRAINT "discovery_fees_branch_id_program_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."program_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_fees" ADD CONSTRAINT "discovery_fees_instructor_profile_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_profile_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_fees" ADD CONSTRAINT "discovery_fees_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_lessons" ADD CONSTRAINT "discovery_lessons_candidate_id_candidate_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_lessons" ADD CONSTRAINT "discovery_lessons_instructor_profile_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_profile_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_lessons" ADD CONSTRAINT "discovery_lessons_branch_id_program_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."program_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_lessons" ADD CONSTRAINT "discovery_lessons_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_fees_branch_unique" ON "discovery_fees" USING btree ("branch_id") WHERE "discovery_fees"."scope" = 'branch' and "discovery_fees"."active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_fees_instructor_unique" ON "discovery_fees" USING btree ("instructor_profile_id") WHERE "discovery_fees"."scope" = 'instructor' and "discovery_fees"."active" = true;--> statement-breakpoint
CREATE INDEX "discovery_lessons_candidate_idx" ON "discovery_lessons" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "discovery_lessons_instructor_scheduled_idx" ON "discovery_lessons" USING btree ("instructor_profile_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "discovery_lessons_status_idx" ON "discovery_lessons" USING btree ("status");