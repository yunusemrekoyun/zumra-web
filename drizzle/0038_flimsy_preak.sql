CREATE TYPE "public"."discount_package_scope" AS ENUM('branch', 'private');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'manual_discount_applied';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'branch_schedule_updated';--> statement-breakpoint
CREATE TABLE "discount_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"scope" "discount_package_scope" NOT NULL,
	"branch_id" uuid,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" integer NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_packages_scope_check" CHECK (("discount_packages"."scope" = 'branch' and "discount_packages"."branch_id" is not null)
        or ("discount_packages"."scope" = 'private' and "discount_packages"."branch_id" is null)),
	CONSTRAINT "discount_packages_value_check" CHECK (("discount_packages"."discount_type" = 'percentage' and "discount_packages"."discount_value" between 1 and 10000)
        or ("discount_packages"."discount_type" = 'fixed' and "discount_packages"."discount_value" > 0)),
	CONSTRAINT "discount_packages_validity_check" CHECK ("discount_packages"."ends_at" is null or "discount_packages"."starts_at" is null or "discount_packages"."ends_at" > "discount_packages"."starts_at"),
	CONSTRAINT "discount_packages_name_check" CHECK (length(trim("discount_packages"."name")) >= 2)
);
--> statement-breakpoint
CREATE TABLE "private_lesson_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"hours" integer NOT NULL,
	"total_price_cents" integer NOT NULL,
	"hourly_price_cents" integer NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "private_lesson_packages_currency_check" CHECK ("private_lesson_packages"."currency" = 'TRY'),
	CONSTRAINT "private_lesson_packages_values_check" CHECK ("private_lesson_packages"."hours" > 0
        and "private_lesson_packages"."total_price_cents" > 0
        and "private_lesson_packages"."hourly_price_cents" > 0),
	CONSTRAINT "private_lesson_packages_name_check" CHECK (length(trim("private_lesson_packages"."name")) >= 2)
);
--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "private_lesson_package_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "discount_package_id" uuid;--> statement-breakpoint
ALTER TABLE "discount_packages" ADD CONSTRAINT "discount_packages_branch_id_program_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."program_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_packages" ADD CONSTRAINT "discount_packages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_lesson_packages" ADD CONSTRAINT "private_lesson_packages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discount_packages_branch_idx" ON "discount_packages" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "discount_packages_scope_idx" ON "discount_packages" USING btree ("scope","active");--> statement-breakpoint
CREATE INDEX "private_lesson_packages_language_idx" ON "private_lesson_packages" USING btree ("language","active");--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_private_lesson_package_id_private_lesson_packages_id_fk" FOREIGN KEY ("private_lesson_package_id") REFERENCES "public"."private_lesson_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD CONSTRAINT "enrollment_drafts_discount_package_id_discount_packages_id_fk" FOREIGN KEY ("discount_package_id") REFERENCES "public"."discount_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "enrollments" SET "financial_snapshot" = "financial_snapshot" || '{"discountSource":"manual"}'::jsonb WHERE COALESCE(("financial_snapshot"->>'discountCents')::int, 0) > 0 AND "financial_snapshot"->>'discountSource' IS NULL;
