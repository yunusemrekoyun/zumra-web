-- Clear any already-dangling photo pointers so the constraint can attach.
UPDATE "users" SET "photo_media_asset_id" = NULL
WHERE "photo_media_asset_id" IS NOT NULL
  AND "photo_media_asset_id" NOT IN (SELECT "id" FROM "media_assets");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_photo_media_asset_id_media_assets_id_fk" FOREIGN KEY ("photo_media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
