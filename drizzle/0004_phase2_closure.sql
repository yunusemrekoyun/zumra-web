ALTER TYPE "public"."backup_kind" ADD VALUE 'restic_check' BEFORE 'restore_drill';--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "processing_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "quarantine_delete_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "backup_snapshot_id" text;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "worker_heartbeats" ADD COLUMN "release_id" text DEFAULT 'development' NOT NULL;--> statement-breakpoint
CREATE OR REPLACE FUNCTION revoke_sessions_on_credential_password_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF
    NEW.provider_id = 'credential' AND
    OLD.password IS DISTINCT FROM NEW.password
  THEN
    DELETE FROM sessions WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS accounts_revoke_sessions_on_password_change ON accounts;--> statement-breakpoint
CREATE TRIGGER accounts_revoke_sessions_on_password_change
AFTER UPDATE OF password ON accounts
FOR EACH ROW
EXECUTE FUNCTION revoke_sessions_on_credential_password_change();--> statement-breakpoint
CREATE OR REPLACE FUNCTION revoke_sessions_on_sensitive_user_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.role IS DISTINCT FROM NEW.role OR
    OLD.account_status IS DISTINCT FROM NEW.account_status OR
    OLD.two_factor_enabled IS DISTINCT FROM NEW.two_factor_enabled
  THEN
    DELETE FROM sessions WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
GRANT UPDATE (backup_verified_at, backup_snapshot_id, updated_at) ON TABLE media_assets TO zumra_backup;
