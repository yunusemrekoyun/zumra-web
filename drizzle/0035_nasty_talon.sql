CREATE TYPE "public"."commission_scope" AS ENUM('branch', 'instructor_private');--> statement-breakpoint
CREATE TYPE "public"."installment_status" AS ENUM('pending', 'partial', 'paid');--> statement-breakpoint
CREATE TYPE "public"."payment_record_status" AS ENUM('reported', 'confirmed', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'payment_reported';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'payment_confirmed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'payment_rejected';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'payment_review_stale';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'installment_due';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'settlement_recorded';--> statement-breakpoint
CREATE TABLE "commission_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "commission_scope" NOT NULL,
	"branch_id" uuid,
	"instructor_id" uuid,
	"teacher_share_basis_points" integer NOT NULL,
	"note" text,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_rates_scope_check" CHECK (("commission_rates"."scope" = 'branch' and "commission_rates"."branch_id" is not null and "commission_rates"."instructor_id" is null)
        or ("commission_rates"."scope" = 'instructor_private' and "commission_rates"."instructor_id" is not null and "commission_rates"."branch_id" is null)),
	CONSTRAINT "commission_rates_share_check" CHECK ("commission_rates"."teacher_share_basis_points" >= 0 and "commission_rates"."teacher_share_basis_points" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "enrollment_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"label" text,
	"amount_cents" integer NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"due_date" date NOT NULL,
	"status" "installment_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_installments_currency_check" CHECK ("enrollment_installments"."currency" = 'TRY'),
	CONSTRAINT "enrollment_installments_amounts_check" CHECK ("enrollment_installments"."sequence" >= 1
        and "enrollment_installments"."amount_cents" > 0
        and "enrollment_installments"."paid_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "instructor_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"iban_encrypted" text NOT NULL,
	"iban_blind_index" text NOT NULL,
	"iban_last_four" text NOT NULL,
	"holder_name" text,
	"archived_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"installment_id" uuid,
	"instructor_id" uuid NOT NULL,
	"bank_account_id" uuid,
	"status" "payment_record_status" DEFAULT 'reported' NOT NULL,
	"declared_amount_cents" integer,
	"amount_cents" integer,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"method" text,
	"student_note" text,
	"review_note" text,
	"receipt_media_asset_id" uuid,
	"reported_by_user_id" text NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"teacher_share_basis_points" integer,
	"zumra_share_cents" integer,
	"settlement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_records_currency_check" CHECK ("payment_records"."currency" = 'TRY'),
	CONSTRAINT "payment_records_amounts_check" CHECK (("payment_records"."declared_amount_cents" is null or "payment_records"."declared_amount_cents" >= 0)
        and ("payment_records"."amount_cents" is null or "payment_records"."amount_cents" > 0)
        and ("payment_records"."zumra_share_cents" is null or "payment_records"."zumra_share_cents" >= 0)
        and ("payment_records"."teacher_share_basis_points" is null
          or ("payment_records"."teacher_share_basis_points" >= 0 and "payment_records"."teacher_share_basis_points" <= 10000))),
	CONSTRAINT "payment_records_confirmed_check" CHECK ("payment_records"."status" <> 'confirmed'
        or ("payment_records"."amount_cents" is not null and "payment_records"."reviewed_by_user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "teacher_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"note" text,
	"received_by_user_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_settlements_currency_check" CHECK ("teacher_settlements"."currency" = 'TRY'),
	CONSTRAINT "teacher_settlements_total_check" CHECK ("teacher_settlements"."total_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "commission_rates" ADD CONSTRAINT "commission_rates_branch_id_program_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."program_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rates" ADD CONSTRAINT "commission_rates_instructor_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rates" ADD CONSTRAINT "commission_rates_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_installments" ADD CONSTRAINT "enrollment_installments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_installments" ADD CONSTRAINT "enrollment_installments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_bank_accounts" ADD CONSTRAINT "instructor_bank_accounts_instructor_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_bank_accounts" ADD CONSTRAINT "instructor_bank_accounts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_installment_id_enrollment_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."enrollment_installments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_instructor_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_bank_account_id_instructor_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."instructor_bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_receipt_media_asset_id_media_assets_id_fk" FOREIGN KEY ("receipt_media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_settlement_id_teacher_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."teacher_settlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_settlements" ADD CONSTRAINT "teacher_settlements_instructor_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_settlements" ADD CONSTRAINT "teacher_settlements_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_rates_branch_unique" ON "commission_rates" USING btree ("branch_id") WHERE "commission_rates"."scope" = 'branch';--> statement-breakpoint
CREATE UNIQUE INDEX "commission_rates_instructor_unique" ON "commission_rates" USING btree ("instructor_id") WHERE "commission_rates"."scope" = 'instructor_private';--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_installments_sequence_unique" ON "enrollment_installments" USING btree ("enrollment_id","sequence");--> statement-breakpoint
CREATE INDEX "enrollment_installments_enrollment_idx" ON "enrollment_installments" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "enrollment_installments_due_idx" ON "enrollment_installments" USING btree ("due_date","status");--> statement-breakpoint
CREATE UNIQUE INDEX "instructor_bank_accounts_active_unique" ON "instructor_bank_accounts" USING btree ("instructor_id") WHERE "instructor_bank_accounts"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "instructor_bank_accounts_instructor_idx" ON "instructor_bank_accounts" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "instructor_bank_accounts_blind_index_idx" ON "instructor_bank_accounts" USING btree ("iban_blind_index");--> statement-breakpoint
CREATE INDEX "payment_records_enrollment_idx" ON "payment_records" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "payment_records_instructor_status_idx" ON "payment_records" USING btree ("instructor_id","status");--> statement-breakpoint
CREATE INDEX "payment_records_status_reported_idx" ON "payment_records" USING btree ("status","reported_at");--> statement-breakpoint
CREATE INDEX "payment_records_unsettled_idx" ON "payment_records" USING btree ("instructor_id") WHERE "payment_records"."settlement_id" is null and "payment_records"."status" = 'confirmed';--> statement-breakpoint
CREATE INDEX "teacher_settlements_instructor_idx" ON "teacher_settlements" USING btree ("instructor_id");