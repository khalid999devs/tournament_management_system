CREATE TYPE "public"."assignment_scope" AS ENUM('ALL_TOURNAMENT', 'GAME', 'ROUND', 'MATCH', 'PARTICIPANT_ENTRY');--> statement-breakpoint
CREATE TYPE "public"."game_entry_status" AS ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."match_outcome" AS ENUM('WIN', 'LOSS', 'DRAW', 'DQ', 'DNS');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'WALKOVER', 'POSTPONED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('QUEUED', 'SENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('REGISTRATION_SUBMITTED', 'REGISTRATION_APPROVED', 'REGISTRATION_REJECTED', 'EVENT_REMINDER', 'SCHEDULE_CHANGED', 'OPERATOR_INVITE');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('SUBMITTED', 'VERIFIED', 'REJECTED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."progression_mode" AS ENUM('AUTOMATIC_SINGLE_ELIMINATION', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('SUPER_ADMIN', 'SCORE_OPERATOR');--> statement-breakpoint
CREATE TYPE "public"."tournament_game_status" AS ENUM('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ACTIVE', 'COMPLETED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "operator_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"scope_type" "assignment_scope" NOT NULL,
	"tournament_game_id" uuid,
	"round_id" uuid,
	"match_id" uuid,
	"registration_game_entry_id" uuid,
	"capabilities" jsonb DEFAULT '["VIEW","SCORE_UPDATE","FINALIZE_MATCH","ISSUE_REPORT"]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"granted_by" uuid NOT NULL,
	"revoked_by" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operator_assignments_scope_target_check" CHECK (
        ("operator_assignments"."scope_type" = 'ALL_TOURNAMENT' and "operator_assignments"."tournament_game_id" is null and "operator_assignments"."round_id" is null and "operator_assignments"."match_id" is null and "operator_assignments"."registration_game_entry_id" is null)
        or ("operator_assignments"."scope_type" = 'GAME' and "operator_assignments"."tournament_game_id" is not null and "operator_assignments"."round_id" is null and "operator_assignments"."match_id" is null and "operator_assignments"."registration_game_entry_id" is null)
        or ("operator_assignments"."scope_type" = 'ROUND' and "operator_assignments"."tournament_game_id" is null and "operator_assignments"."round_id" is not null and "operator_assignments"."match_id" is null and "operator_assignments"."registration_game_entry_id" is null)
        or ("operator_assignments"."scope_type" = 'MATCH' and "operator_assignments"."tournament_game_id" is null and "operator_assignments"."round_id" is null and "operator_assignments"."match_id" is not null and "operator_assignments"."registration_game_entry_id" is null)
        or ("operator_assignments"."scope_type" = 'PARTICIPANT_ENTRY' and "operator_assignments"."tournament_game_id" is null and "operator_assignments"."round_id" is null and "operator_assignments"."match_id" is null and "operator_assignments"."registration_game_entry_id" is not null)
      ),
	CONSTRAINT "operator_assignments_revocation_check" CHECK (("operator_assignments"."active" and "operator_assignments"."revoked_at" is null and "operator_assignments"."revoked_by" is null) or (not "operator_assignments"."active" and "operator_assignments"."revoked_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "operator_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "match_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"registration_game_entry_id" uuid NOT NULL,
	"seat" integer NOT NULL,
	"placement" integer,
	"points" integer,
	"outcome" "match_outcome",
	"result_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_entries_seat_positive_check" CHECK ("match_entries"."seat" > 0),
	CONSTRAINT "match_entries_placement_positive_check" CHECK ("match_entries"."placement" is null or "match_entries"."placement" > 0)
);
--> statement-breakpoint
ALTER TABLE "match_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "match_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"actor_staff_id" uuid NOT NULL,
	"update_type" varchar(80) NOT NULL,
	"match_version" integer NOT NULL,
	"payload_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_updates_version_positive_check" CHECK ("match_updates"."match_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "match_updates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"code" varchar(48) NOT NULL,
	"status" "match_status" DEFAULT 'SCHEDULED' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"venue" varchar(180),
	"station" varchar(80),
	"display_score" varchar(160),
	"result_json" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"next_match_id" uuid,
	"next_match_seat" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_version_positive_check" CHECK ("matches"."version" > 0),
	CONSTRAINT "matches_next_seat_positive_check" CHECK ("matches"."next_match_seat" is null or "matches"."next_match_seat" > 0)
);
--> statement-breakpoint
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_game_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"sequence" integer NOT NULL,
	"status" "round_status" DEFAULT 'DRAFT' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rounds_sequence_positive_check" CHECK ("rounds"."sequence" > 0)
);
--> statement-breakpoint
ALTER TABLE "rounds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_student_id" varchar(64) NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"department" varchar(120) NOT NULL,
	"academic_year" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"receiving_account_snapshot" varchar(120) NOT NULL,
	"expected_amount_minor" integer NOT NULL,
	"transaction_id_raw" varchar(160) NOT NULL,
	"transaction_id_normalized" varchar(160) NOT NULL,
	"status" "payment_status" DEFAULT 'SUBMITTED' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_expected_amount_nonnegative_check" CHECK ("payments"."expected_amount_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "registration_game_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"tournament_game_id" uuid NOT NULL,
	"status" "game_entry_status" DEFAULT 'PENDING' NOT NULL,
	"seed" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_game_entries_seed_positive_check" CHECK ("registration_game_entries"."seed" is null or "registration_game_entries"."seed" > 0)
);
--> statement-breakpoint
ALTER TABLE "registration_game_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"tournament_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"status" "registration_status" DEFAULT 'PENDING_REVIEW' NOT NULL,
	"total_fee_minor" integer NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"internal_note" text,
	"idempotency_key" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_fee_nonnegative_check" CHECK ("registrations"."total_fee_minor" >= 0),
	CONSTRAINT "registrations_rejection_reason_check" CHECK ("registrations"."status" <> 'REJECTED' or "registrations"."rejection_reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"role" "staff_role" NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_staff_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid,
	"before_json" jsonb,
	"after_json" jsonb,
	"reason" text,
	"request_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid,
	"staff_profile_id" uuid,
	"recipient_email" varchar(254) NOT NULL,
	"type" "notification_type" NOT NULL,
	"status" "notification_status" DEFAULT 'QUEUED' NOT NULL,
	"provider_message_id" varchar(180),
	"error_text" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"idempotency_key" varchar(180) NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_retry_nonnegative_check" CHECK ("notifications"."retry_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"icon_key" varchar(80),
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"display_name" varchar(80) NOT NULL,
	"receiving_account" varchar(120) NOT NULL,
	"instructions" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tournament_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"fee_minor" integer DEFAULT 0 NOT NULL,
	"capacity" integer NOT NULL,
	"reserved_count" integer DEFAULT 0 NOT NULL,
	"confirmed_count" integer DEFAULT 0 NOT NULL,
	"status" "tournament_game_status" DEFAULT 'DRAFT' NOT NULL,
	"registration_open" boolean DEFAULT false NOT NULL,
	"scoring_adapter" varchar(80) NOT NULL,
	"progression_mode" "progression_mode" DEFAULT 'MANUAL' NOT NULL,
	"rules" text,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_games_fee_nonnegative_check" CHECK ("tournament_games"."fee_minor" >= 0),
	CONSTRAINT "tournament_games_capacity_positive_check" CHECK ("tournament_games"."capacity" > 0),
	CONSTRAINT "tournament_games_counts_nonnegative_check" CHECK ("tournament_games"."reserved_count" >= 0 and "tournament_games"."confirmed_count" >= 0),
	CONSTRAINT "tournament_games_capacity_limit_check" CHECK ("tournament_games"."reserved_count" + "tournament_games"."confirmed_count" <= "tournament_games"."capacity")
);
--> statement-breakpoint
ALTER TABLE "tournament_games" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"year" integer NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Dhaka' NOT NULL,
	"venue" varchar(240),
	"registration_open_at" timestamp with time zone,
	"registration_close_at" timestamp with time zone,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"max_games_per_participant" integer DEFAULT 1 NOT NULL,
	"status" "tournament_status" DEFAULT 'DRAFT' NOT NULL,
	"public_settings" jsonb DEFAULT '{"resultsEnabled":false,"publicCapacityEnabled":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_max_games_positive_check" CHECK ("tournaments"."max_games_per_participant" > 0),
	CONSTRAINT "tournaments_registration_window_check" CHECK ("tournaments"."registration_close_at" is null or "tournaments"."registration_open_at" is null or "tournaments"."registration_close_at" > "tournaments"."registration_open_at"),
	CONSTRAINT "tournaments_event_window_check" CHECK ("tournaments"."ends_at" is null or "tournaments"."starts_at" is null or "tournaments"."ends_at" >= "tournaments"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "tournaments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_operator_id_staff_profiles_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_tournament_game_id_tournament_games_id_fk" FOREIGN KEY ("tournament_game_id") REFERENCES "public"."tournament_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_registration_game_entry_id_registration_game_entries_id_fk" FOREIGN KEY ("registration_game_entry_id") REFERENCES "public"."registration_game_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_granted_by_staff_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_revoked_by_staff_profiles_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_entries" ADD CONSTRAINT "match_entries_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_entries" ADD CONSTRAINT "match_entries_registration_game_entry_id_registration_game_entries_id_fk" FOREIGN KEY ("registration_game_entry_id") REFERENCES "public"."registration_game_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_updates" ADD CONSTRAINT "match_updates_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_updates" ADD CONSTRAINT "match_updates_actor_staff_id_staff_profiles_id_fk" FOREIGN KEY ("actor_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_next_match_id_fk" FOREIGN KEY ("next_match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_tournament_game_id_tournament_games_id_fk" FOREIGN KEY ("tournament_game_id") REFERENCES "public"."tournament_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_staff_profiles_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_game_entries" ADD CONSTRAINT "registration_game_entries_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_game_entries" ADD CONSTRAINT "registration_game_entries_tournament_game_id_tournament_games_id_fk" FOREIGN KEY ("tournament_game_id") REFERENCES "public"."tournament_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_reviewed_by_staff_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_staff_id_staff_profiles_id_fk" FOREIGN KEY ("actor_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operator_assignments_operator_active_idx" ON "operator_assignments" USING btree ("operator_id","active","tournament_id");--> statement-breakpoint
CREATE INDEX "operator_assignments_tournament_idx" ON "operator_assignments" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "operator_assignments_game_idx" ON "operator_assignments" USING btree ("tournament_game_id","active");--> statement-breakpoint
CREATE INDEX "operator_assignments_round_idx" ON "operator_assignments" USING btree ("round_id","active");--> statement-breakpoint
CREATE INDEX "operator_assignments_match_idx" ON "operator_assignments" USING btree ("match_id","active");--> statement-breakpoint
CREATE INDEX "operator_assignments_entry_idx" ON "operator_assignments" USING btree ("registration_game_entry_id","active");--> statement-breakpoint
CREATE INDEX "operator_assignments_granted_by_idx" ON "operator_assignments" USING btree ("granted_by");--> statement-breakpoint
CREATE INDEX "operator_assignments_revoked_by_idx" ON "operator_assignments" USING btree ("revoked_by");--> statement-breakpoint
CREATE UNIQUE INDEX "match_entries_match_registration_entry_uidx" ON "match_entries" USING btree ("match_id","registration_game_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_entries_match_seat_uidx" ON "match_entries" USING btree ("match_id","seat");--> statement-breakpoint
CREATE INDEX "match_entries_registration_entry_idx" ON "match_entries" USING btree ("registration_game_entry_id");--> statement-breakpoint
CREATE INDEX "match_updates_match_created_idx" ON "match_updates" USING btree ("match_id","created_at","id");--> statement-breakpoint
CREATE INDEX "match_updates_actor_created_idx" ON "match_updates" USING btree ("actor_staff_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_round_code_uidx" ON "matches" USING btree ("round_id","code");--> statement-breakpoint
CREATE INDEX "matches_round_status_schedule_idx" ON "matches" USING btree ("round_id","status","scheduled_at","id");--> statement-breakpoint
CREATE INDEX "matches_next_match_idx" ON "matches" USING btree ("next_match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_game_sequence_uidx" ON "rounds" USING btree ("tournament_game_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_student_id_uidx" ON "participants" USING btree ("normalized_student_id");--> statement-breakpoint
CREATE INDEX "participants_name_idx" ON "participants" USING btree ("full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_registration_uidx" ON "payments" USING btree ("registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_transaction_uidx" ON "payments" USING btree ("provider","transaction_id_normalized");--> statement-breakpoint
CREATE INDEX "payments_status_created_idx" ON "payments" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "payments_verified_by_idx" ON "payments" USING btree ("verified_by");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_game_entries_registration_game_uidx" ON "registration_game_entries" USING btree ("registration_id","tournament_game_id");--> statement-breakpoint
CREATE INDEX "registration_game_entries_game_status_idx" ON "registration_game_entries" USING btree ("tournament_game_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_code_uidx" ON "registrations" USING btree ("tournament_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_idempotency_uidx" ON "registrations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_active_participant_uidx" ON "registrations" USING btree ("tournament_id","participant_id") WHERE "registrations"."status" in ('PENDING_REVIEW', 'CONFIRMED');--> statement-breakpoint
CREATE INDEX "registrations_queue_idx" ON "registrations" USING btree ("tournament_id","status","submitted_at","id");--> statement-breakpoint
CREATE INDEX "registrations_participant_idx" ON "registrations" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "registrations_reviewed_by_idx" ON "registrations" USING btree ("reviewed_by");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profiles_auth_user_uidx" ON "staff_profiles" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "staff_profiles_role_active_idx" ON "staff_profiles" USING btree ("role","active");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs" USING btree ("actor_staff_id","created_at","id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_created_idx" ON "audit_logs" USING btree ("action","created_at","id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_status_created_idx" ON "notifications" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_email","created_at");--> statement-breakpoint
CREATE INDEX "notifications_registration_idx" ON "notifications" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "notifications_staff_profile_idx" ON "notifications" USING btree ("staff_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_idempotency_uidx" ON "notifications" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "games_slug_uidx" ON "games" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "games_name_uidx" ON "games" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_tournament_provider_uidx" ON "payment_methods" USING btree ("tournament_id","provider");--> statement-breakpoint
CREATE INDEX "payment_methods_enabled_idx" ON "payment_methods" USING btree ("tournament_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_games_tournament_game_uidx" ON "tournament_games" USING btree ("tournament_id","game_id");--> statement-breakpoint
CREATE INDEX "tournament_games_registration_idx" ON "tournament_games" USING btree ("tournament_id","status","registration_open");--> statement-breakpoint
CREATE INDEX "tournament_games_game_idx" ON "tournament_games" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_slug_uidx" ON "tournaments" USING btree ("slug");