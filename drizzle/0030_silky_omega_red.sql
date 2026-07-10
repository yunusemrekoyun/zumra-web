CREATE TYPE "public"."appointment_outcome_result" AS ENUM('positive', 'thinking', 'negative');--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD COLUMN "outcome_result" "appointment_outcome_result";--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD COLUMN "follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;