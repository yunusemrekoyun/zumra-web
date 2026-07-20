CREATE TABLE "student_teacher_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"instructor_profile_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_teacher_evaluations" ADD CONSTRAINT "student_teacher_evaluations_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_teacher_evaluations" ADD CONSTRAINT "student_teacher_evaluations_instructor_profile_id_instructor_profiles_id_fk" FOREIGN KEY ("instructor_profile_id") REFERENCES "public"."instructor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_teacher_evaluations_pair_unique" ON "student_teacher_evaluations" USING btree ("student_profile_id","instructor_profile_id");