DROP TRIGGER IF EXISTS users_revoke_sessions_on_sensitive_change ON users;--> statement-breakpoint
CREATE TRIGGER users_revoke_sessions_on_sensitive_change
AFTER UPDATE OF email, role, account_status, two_factor_enabled ON users
FOR EACH ROW
EXECUTE FUNCTION revoke_sessions_on_sensitive_user_change();
