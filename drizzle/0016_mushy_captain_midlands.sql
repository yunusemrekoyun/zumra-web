CREATE TABLE "student_account_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrollment_drafts" ADD COLUMN "student_username" text;--> statement-breakpoint
ALTER TABLE "student_account_invitations" ADD CONSTRAINT "student_account_invitations_student_id_student_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_account_invitations" ADD CONSTRAINT "student_account_invitations_invitation_id_user_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."user_invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_account_invitation_unique" ON "student_account_invitations" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "student_account_student_idx" ON "student_account_invitations" USING btree ("student_id");