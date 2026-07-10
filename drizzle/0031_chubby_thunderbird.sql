CREATE TYPE "public"."advisor_task_kind" AS ENUM('appointment_request', 'first_contact', 'follow_up', 'retry_contact', 'manual');--> statement-breakpoint
CREATE TYPE "public"."advisor_task_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TYPE "public"."advisor_task_visibility" AS ENUM('staff', 'private');--> statement-breakpoint
CREATE TABLE "advisor_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "advisor_task_kind" NOT NULL,
	"status" "advisor_task_status" DEFAULT 'open' NOT NULL,
	"visibility" "advisor_task_visibility" DEFAULT 'staff' NOT NULL,
	"title" text,
	"note" text,
	"candidate_id" uuid,
	"appointment_id" uuid,
	"assignee_user_id" text,
	"created_by_user_id" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advisor_tasks" ADD CONSTRAINT "advisor_tasks_candidate_id_candidate_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_tasks" ADD CONSTRAINT "advisor_tasks_appointment_id_appointment_requests_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointment_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_tasks" ADD CONSTRAINT "advisor_tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_tasks" ADD CONSTRAINT "advisor_tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_tasks" ADD CONSTRAINT "advisor_tasks_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advisor_tasks_assignee_status_idx" ON "advisor_tasks" USING btree ("assignee_user_id","status");--> statement-breakpoint
CREATE INDEX "advisor_tasks_status_due_idx" ON "advisor_tasks" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "advisor_tasks_candidate_idx" ON "advisor_tasks" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "advisor_tasks_open_candidate_kind_unique" ON "advisor_tasks" USING btree ("candidate_id","kind") WHERE "advisor_tasks"."status" = 'open' and "advisor_tasks"."candidate_id" is not null and "advisor_tasks"."kind" <> 'manual';