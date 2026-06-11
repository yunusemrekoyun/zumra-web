ALTER TYPE "public"."backup_kind" ADD VALUE 'restic_forget' BEFORE 'restore_drill';--> statement-breakpoint
ALTER TYPE "public"."backup_kind" ADD VALUE 'restic_prune' BEFORE 'restore_drill';