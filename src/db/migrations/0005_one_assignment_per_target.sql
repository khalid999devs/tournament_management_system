-- Collapse assignments that repeat the same operator and target. An active row
-- wins over a revoked one, then the most recent grant wins.
DELETE FROM "operator_assignments" a
USING "operator_assignments" b
WHERE a."operator_id" = b."operator_id"
  AND a."scope_type" = b."scope_type"
  AND a."tournament_id" = b."tournament_id"
  AND a."tournament_game_id" IS NOT DISTINCT FROM b."tournament_game_id"
  AND a."round_id" IS NOT DISTINCT FROM b."round_id"
  AND a."match_id" IS NOT DISTINCT FROM b."match_id"
  AND a."registration_game_entry_id" IS NOT DISTINCT FROM b."registration_game_entry_id"
  AND (a."active", a."created_at", a."id") < (b."active", b."created_at", b."id");
--> statement-breakpoint
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_scope_unique" UNIQUE NULLS NOT DISTINCT("operator_id","scope_type","tournament_id","tournament_game_id","round_id","match_id","registration_game_entry_id");
