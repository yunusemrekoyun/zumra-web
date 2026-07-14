-- Collapse pre-existing duplicates first: keep the newest active appointment
-- per candidate, cancel the rest, so the unique index below can be created.
UPDATE "appointment_requests" SET "status" = 'cancelled', "updated_at" = now()
WHERE "status" IN ('requested', 'scheduled')
  AND "id" NOT IN (
    SELECT DISTINCT ON ("candidate_id") "id"
    FROM "appointment_requests"
    WHERE "status" IN ('requested', 'scheduled')
    ORDER BY "candidate_id", "created_at" DESC
  );--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_requests_active_candidate_unique" ON "appointment_requests" USING btree ("candidate_id") WHERE "appointment_requests"."status" in ('requested', 'scheduled');
