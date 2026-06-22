ALTER TABLE "candidate_inquiries" ADD COLUMN "program_id" uuid;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "public_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "marketing_icon" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "popular" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_inquiries" ADD CONSTRAINT "candidate_inquiries_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_inquiries_program_idx" ON "candidate_inquiries" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "programs_public_visible_idx" ON "programs" USING btree ("public_visible","display_order");