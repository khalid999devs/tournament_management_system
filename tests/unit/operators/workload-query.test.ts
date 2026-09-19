import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabase } from "@/db";
import { matches, rounds, tournamentGames } from "@/db/schema";
import { operatorMatchAccessPredicate } from "@/features/operators/server/workload";

describe("operator workload query", () => {
  it("filters every scope before pagination without joining payments", () => {
    const db = createDatabase("postgresql://test:test@localhost:5432/test");
    const query = db
      .select({ id: matches.id })
      .from(matches)
      .innerJoin(rounds, eq(matches.roundId, rounds.id))
      .innerJoin(
        tournamentGames,
        eq(rounds.tournamentGameId, tournamentGames.id),
      )
      .where(operatorMatchAccessPredicate("operator-id", "VIEW", db))
      .limit(20)
      .toSQL();

    expect(query.sql).toContain('"operator_assignments"."active"');
    expect(query.sql).toContain("ALL_TOURNAMENT");
    expect(query.sql).toContain("PARTICIPANT_ENTRY");
    expect(query.sql).toContain('"operator_assignments"."tournament_id"');
    expect(query.sql).toContain("limit");
    expect(query.sql).not.toContain("payments");
    expect(query.params).toContain("operator-id");
    expect(query.params).toContain('["VIEW"]');
  });
});
