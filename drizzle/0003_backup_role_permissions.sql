GRANT INSERT, UPDATE ON TABLE backup_runs TO zumra_backup;
--> statement-breakpoint
GRANT UPDATE (backup_verified_at, updated_at) ON TABLE media_assets TO zumra_backup;
