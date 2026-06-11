#!/bin/sh
set -eu

psql \
  -v ON_ERROR_STOP=1 \
  -v app_user="$APP_DB_USER" \
  -v app_password="$APP_DB_PASSWORD" \
  -v backup_user="$BACKUP_DB_USER" \
  -v backup_password="$BACKUP_DB_PASSWORD" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<-'SQL'
  SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
  \gexec

  SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'backup_user', :'backup_password')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'backup_user')
  \gexec

  SELECT format(
    'GRANT CONNECT ON DATABASE %I TO %I, %I',
    current_database(),
    :'app_user',
    :'backup_user'
  )
  \gexec
  SELECT format('GRANT USAGE ON SCHEMA public TO %I, %I', :'app_user', :'backup_user')
  \gexec

  SELECT format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
    current_user,
    :'app_user'
  )
  \gexec
  SELECT format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
    current_user,
    :'app_user'
  )
  \gexec
  SELECT format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT ON TABLES TO %I',
    current_user,
    :'backup_user'
  )
  \gexec
SQL
