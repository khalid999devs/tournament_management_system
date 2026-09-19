CREATE TYPE "public"."issue_status" AS ENUM('OPEN', 'RESOLVED');--> statement-breakpoint
CREATE TABLE "issue_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"match_id" uuid,
	"reported_by" uuid NOT NULL,
	"category" varchar(40) NOT NULL,
	"message" text NOT NULL,
	"status" "issue_status" DEFAULT 'OPEN' NOT NULL,
	"resolution_note" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"client_request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_reports_resolution_check" CHECK (("issue_reports"."status" = 'RESOLVED') = ("issue_reports"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "issue_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "reminder_days_before" integer;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_reported_by_staff_profiles_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_resolved_by_staff_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "issue_reports_client_request_uidx" ON "issue_reports" USING btree ("client_request_id");--> statement-breakpoint
CREATE INDEX "issue_reports_queue_idx" ON "issue_reports" USING btree ("tournament_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "issue_reports_match_idx" ON "issue_reports" USING btree ("match_id","created_at");--> statement-breakpoint
CREATE INDEX "issue_reports_reporter_idx" ON "issue_reports" USING btree ("reported_by","created_at");--> statement-breakpoint
CREATE INDEX "issue_reports_resolved_by_idx" ON "issue_reports" USING btree ("resolved_by");--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_reminder_days_check" CHECK ("tournaments"."reminder_days_before" is null or "tournaments"."reminder_days_before" between 1 and 14);--> statement-breakpoint
-- Live updates: staff browsers listen on private Realtime channels. Only
-- active staff may join, and no browser may send (there is no insert
-- policy); the server sends with the secret key. Skipped on plain
-- PostgreSQL, where Supabase's realtime and auth schemas do not exist.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL THEN
    RETURN;
  END IF;

  CREATE SCHEMA IF NOT EXISTS private;

  CREATE OR REPLACE FUNCTION private.is_active_staff()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
  AS $body$
    SELECT EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE auth_user_id = (SELECT auth.uid()) AND active
    )
  $body$;

  REVOKE ALL ON FUNCTION private.is_active_staff() FROM PUBLIC, anon;
  GRANT USAGE ON SCHEMA private TO authenticated;
  GRANT EXECUTE ON FUNCTION private.is_active_staff() TO authenticated;

  DROP POLICY IF EXISTS "Active staff receive live updates" ON realtime.messages;
  CREATE POLICY "Active staff receive live updates"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      realtime.messages.extension = 'broadcast'
      AND (SELECT private.is_active_staff())
    );
END
$$;
