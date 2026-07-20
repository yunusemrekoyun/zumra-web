CREATE TABLE "staff_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_a_user_id" text NOT NULL,
	"participant_b_user_id" text NOT NULL,
	"last_message_at" timestamp with time zone,
	"a_last_read_at" timestamp with time zone,
	"b_last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_conversations_order_check" CHECK ("staff_conversations"."participant_a_user_id" < "staff_conversations"."participant_b_user_id")
);
--> statement-breakpoint
CREATE TABLE "staff_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_conversations" ADD CONSTRAINT "staff_conversations_participant_a_user_id_users_id_fk" FOREIGN KEY ("participant_a_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_conversations" ADD CONSTRAINT "staff_conversations_participant_b_user_id_users_id_fk" FOREIGN KEY ("participant_b_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_messages" ADD CONSTRAINT "staff_messages_conversation_id_staff_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."staff_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_messages" ADD CONSTRAINT "staff_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_conversations_pair_unique" ON "staff_conversations" USING btree ("participant_a_user_id","participant_b_user_id");--> statement-breakpoint
CREATE INDEX "staff_conversations_a_idx" ON "staff_conversations" USING btree ("participant_a_user_id");--> statement-breakpoint
CREATE INDEX "staff_conversations_b_idx" ON "staff_conversations" USING btree ("participant_b_user_id");--> statement-breakpoint
CREATE INDEX "staff_messages_conversation_created_idx" ON "staff_messages" USING btree ("conversation_id","created_at");