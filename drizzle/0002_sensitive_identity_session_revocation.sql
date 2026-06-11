CREATE OR REPLACE FUNCTION revoke_sessions_on_sensitive_user_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.role IS DISTINCT FROM NEW.role OR
    OLD.account_status IS DISTINCT FROM NEW.account_status
  THEN
    DELETE FROM sessions WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS users_revoke_sessions_on_sensitive_change ON users;
--> statement-breakpoint
CREATE TRIGGER users_revoke_sessions_on_sensitive_change
AFTER UPDATE OF email, role, account_status ON users
FOR EACH ROW
EXECUTE FUNCTION revoke_sessions_on_sensitive_user_change();
