CREATE TYPE "public"."account_status" AS ENUM('pending', 'active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."session_security_level" AS ENUM('pending', 'standard', 'fresh', 'mfa');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'advisor', 'teacher', 'student');--> statement-breakpoint
CREATE TYPE "public"."backup_kind" AS ENUM('logical', 'physical_full', 'physical_differential', 'wal', 'restic', 'restore_drill');--> statement-breakpoint
CREATE TYPE "public"."backup_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'document', 'audio');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('uploading', 'uploaded', 'scanning', 'processing', 'ready', 'failed', 'quarantined');--> statement-breakpoint
CREATE TYPE "public"."media_visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'queued', 'processing', 'sent', 'failed', 'dead');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"security_level" "session_security_level" DEFAULT 'pending' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"device_id" text
);
--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"account_status" "account_status" DEFAULT 'pending' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"result" text NOT NULL,
	"request_id" text NOT NULL,
	"masked_ip" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "backup_kind" NOT NULL,
	"status" "backup_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"size_bytes" bigint,
	"snapshot_id" text,
	"error_summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"kind" "media_kind" NOT NULL,
	"visibility" "media_visibility" DEFAULT 'private' NOT NULL,
	"status" "media_status" DEFAULT 'uploading' NOT NULL,
	"original_name" text NOT NULL,
	"source_path" text,
	"output_path" text,
	"thumbnail_path" text,
	"mime_type" text,
	"size_bytes" bigint,
	"checksum_sha256" text,
	"duration_seconds" numeric(10, 3),
	"width" integer,
	"height" integer,
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"source_delete_after" timestamp with time zone,
	"backup_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"channel" text NOT NULL,
	"template_key" text NOT NULL,
	"recipient" text NOT NULL,
	"locale" text DEFAULT 'tr' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"purpose" text NOT NULL,
	"secret_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"result" text NOT NULL,
	"request_id" text,
	"masked_ip" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trusted_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"device_id_hash" text NOT NULL,
	"label" text,
	"user_agent_hash" text,
	"verified_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"worker_id" text PRIMARY KEY NOT NULL,
	"worker_type" text NOT NULL,
	"hostname" text NOT NULL,
	"process_id" integer NOT NULL,
	"version" text NOT NULL,
	"healthy" boolean DEFAULT true NOT NULL,
	"active_jobs" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_challenges" ADD CONSTRAINT "security_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_unique" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "two_factors_secret_idx" ON "two_factors" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factors_user_id_idx" ON "two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_account_status_idx" ON "users" USING btree ("account_status");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verifications_expires_at_idx" ON "verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "backup_runs_kind_started_idx" ON "backup_runs" USING btree ("kind","started_at");--> statement-breakpoint
CREATE INDEX "backup_runs_status_idx" ON "backup_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_assets_owner_created_idx" ON "media_assets" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_idempotency_unique" ON "notification_outbox" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notification_outbox_status_available_idx" ON "notification_outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "security_challenges_user_purpose_idx" ON "security_challenges" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "security_challenges_expires_idx" ON "security_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "security_events_user_created_idx" ON "security_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "security_events_type_created_idx" ON "security_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trusted_devices_user_device_unique" ON "trusted_devices" USING btree ("user_id","device_id_hash");--> statement-breakpoint
CREATE INDEX "trusted_devices_expires_idx" ON "trusted_devices" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_invitations_token_hash_unique" ON "user_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_invitations_email_idx" ON "user_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_invitations_status_expires_idx" ON "user_invitations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "worker_heartbeats_type_seen_idx" ON "worker_heartbeats" USING btree ("worker_type","last_seen_at");
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO zumra_app, zumra_backup;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zumra_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zumra_app;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA public TO zumra_backup;
