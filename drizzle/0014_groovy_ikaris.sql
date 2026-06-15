CREATE TABLE "enrollment_branch_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"from_branch_id" uuid NOT NULL,
	"to_branch_id" uuid NOT NULL,
	"transferred_by_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"capacity_override" boolean DEFAULT false NOT NULL,
	"capacity_override_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_branch_transfers_distinct_branch_check" CHECK ("enrollment_branch_transfers"."from_branch_id" <> "enrollment_branch_transfers"."to_branch_id"),
	CONSTRAINT "enrollment_branch_transfers_override_note_check" CHECK ("enrollment_branch_transfers"."capacity_override" = false
        or length(trim(coalesce("enrollment_branch_transfers"."capacity_override_note", ''))) >= 3)
);
--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ALTER COLUMN "birth_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "instructor_profiles" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "program_branches" ALTER COLUMN "status" SET DEFAULT 'enrollment_open';--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "birth_country_code" text;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "birth_administrative_area" text;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "birth_locality" text;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "corrected_source_detail" text;--> statement-breakpoint
UPDATE "enrollment_drafts"
SET
  "birth_country_code" = COALESCE("birth_country_code", 'TR'),
  "birth_administrative_area" = COALESCE("birth_administrative_area", NULLIF(trim("birth_place"), '')),
  "birth_locality" = COALESCE("birth_locality", NULLIF(trim("birth_place"), ''))
WHERE NULLIF(trim("birth_place"), '') IS NOT NULL;--> statement-breakpoint
ALTER TABLE "program_branches" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollment_branch_transfers" ADD CONSTRAINT "enrollment_branch_transfers_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_branch_transfers" ADD CONSTRAINT "enrollment_branch_transfers_from_branch_id_program_branches_id_fk" FOREIGN KEY ("from_branch_id") REFERENCES "public"."program_branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_branch_transfers" ADD CONSTRAINT "enrollment_branch_transfers_to_branch_id_program_branches_id_fk" FOREIGN KEY ("to_branch_id") REFERENCES "public"."program_branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_branch_transfers" ADD CONSTRAINT "enrollment_branch_transfers_transferred_by_user_id_users_id_fk" FOREIGN KEY ("transferred_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrollment_branch_transfers_enrollment_idx" ON "enrollment_branch_transfers" USING btree ("enrollment_id","created_at");--> statement-breakpoint
CREATE INDEX "enrollment_branch_transfers_from_idx" ON "enrollment_branch_transfers" USING btree ("from_branch_id");--> statement-breakpoint
CREATE INDEX "enrollment_branch_transfers_to_idx" ON "enrollment_branch_transfers" USING btree ("to_branch_id");
