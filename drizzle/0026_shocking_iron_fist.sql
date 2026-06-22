CREATE TABLE "candidate_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"author_user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_candidate_id_candidate_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_notes_candidate_created_idx" ON "candidate_notes" USING btree ("candidate_id","created_at");