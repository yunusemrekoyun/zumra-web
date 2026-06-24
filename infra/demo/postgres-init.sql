-- Demo bootstrap: the migrations GRANT privileges to the zumra_app / zumra_backup
-- roles (created by the full production postgres setup via init-roles.sh). The demo
-- app connects as the superuser, so these roles only need to EXIST for the grants
-- in the migrations to apply. Runs once on first DB init.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_app') THEN
    CREATE ROLE zumra_app;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zumra_backup') THEN
    CREATE ROLE zumra_backup;
  END IF;
END
$$;
