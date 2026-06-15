CREATE TYPE "public"."program_branch_status" AS ENUM('draft', 'enrollment_open', 'enrollment_closed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "program_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "program_branch_status" DEFAULT 'draft' NOT NULL,
	"planned_start_date" date NOT NULL,
	"planned_end_date" date NOT NULL,
	"timezone" text DEFAULT 'Europe/Istanbul' NOT NULL,
	"minimum_capacity" integer DEFAULT 1 NOT NULL,
	"maximum_capacity" integer NOT NULL,
	"teacher_user_id" text,
	"notes" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "program_branches_capacity_check" CHECK ("program_branches"."minimum_capacity" >= 1
        and "program_branches"."maximum_capacity" >= "program_branches"."minimum_capacity"),
	CONSTRAINT "program_branches_date_check" CHECK ("program_branches"."planned_end_date" >= "program_branches"."planned_start_date"),
	CONSTRAINT "program_branches_timezone_check" CHECK (length(trim("program_branches"."timezone")) > 0)
);
--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "capacity_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "capacity_override_by_user_id" text;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "capacity_override_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "capacity_override_note" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "capacity_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "capacity_override_by_user_id" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "capacity_override_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "capacity_override_note" text;--> statement-breakpoint
ALTER TABLE "program_branches" ADD CONSTRAINT "program_branches_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_branches" ADD CONSTRAINT "program_branches_teacher_user_id_users_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_branches" ADD CONSTRAINT "program_branches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "program_branches_program_name_unique" ON "program_branches" USING btree ("program_id","name");--> statement-breakpoint
CREATE INDEX "program_branches_program_status_idx" ON "program_branches" USING btree ("program_id","status");--> statement-breakpoint
CREATE INDEX "program_branches_teacher_idx" ON "program_branches" USING btree ("teacher_user_id");--> statement-breakpoint
CREATE INDEX "program_branches_dates_idx" ON "program_branches" USING btree ("planned_start_date","planned_end_date");--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_branch_id_program_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."program_branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_capacity_override_by_user_id_users_id_fk" FOREIGN KEY ("capacity_override_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_branch_id_program_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."program_branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_capacity_override_by_user_id_users_id_fk" FOREIGN KEY ("capacity_override_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrollment_drafts_branch_idx" ON "enrollment_drafts" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "enrollments_branch_idx" ON "enrollments" USING btree ("branch_id");--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_capacity_override_check" CHECK ("enrollment_drafts"."capacity_override" = false
        or (
          "enrollment_drafts"."branch_id" is not null
          and "enrollment_drafts"."capacity_override_by_user_id" is not null
          and "enrollment_drafts"."capacity_override_at" is not null
        ));--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_capacity_override_check" CHECK ("enrollments"."capacity_override" = false
        or (
          "enrollments"."branch_id" is not null
          and "enrollments"."capacity_override_by_user_id" is not null
          and "enrollments"."capacity_override_at" is not null
        ));--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "program_branches" TO "zumra_app";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_backup') THEN
    GRANT SELECT ON "program_branches" TO "zumra_backup";
  END IF;
END
$$;
