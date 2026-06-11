CREATE TYPE "public"."external_identity_provider" AS ENUM('google');--> statement-breakpoint
CREATE TABLE "external_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" "external_identity_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"verified_email" text NOT NULL,
	"display_name" text NOT NULL,
	"given_name" text,
	"family_name" text,
	"avatar_url" text,
	"provider_locale" text,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "external_identities_user_provider_unique" ON "external_identities" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "external_identities_provider_account_unique" ON "external_identities" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "external_identities_verified_email_idx" ON "external_identities" USING btree ("verified_email");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE external_identities TO zumra_app;--> statement-breakpoint
GRANT SELECT ON TABLE external_identities TO zumra_backup;--> statement-breakpoint
CREATE OR REPLACE FUNCTION remove_google_identity_when_student_role_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF
    OLD.role = 'student' AND
    NEW.role IS DISTINCT FROM 'student'
  THEN
    DELETE FROM external_identities
    WHERE user_id = NEW.id AND provider = 'google';

    DELETE FROM accounts
    WHERE user_id = NEW.id AND provider_id = 'google';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER users_remove_google_identity_on_role_change
AFTER UPDATE OF role ON users
FOR EACH ROW
EXECUTE FUNCTION remove_google_identity_when_student_role_changes();--> statement-breakpoint
CREATE OR REPLACE FUNCTION remove_external_identity_when_google_account_deleted()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.provider_id = 'google' THEN
    DELETE FROM external_identities
    WHERE
      user_id = OLD.user_id AND
      provider = 'google' AND
      provider_account_id = OLD.account_id;
  END IF;

  RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER accounts_remove_external_identity_on_delete
AFTER DELETE ON accounts
FOR EACH ROW
EXECUTE FUNCTION remove_external_identity_when_google_account_deleted();
