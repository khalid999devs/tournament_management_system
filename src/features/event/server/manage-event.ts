import "server-only";

import { and, count, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditLogs,
  games,
  paymentMethods,
  registrationGameEntries,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import {
  evaluateReadiness,
  isReadyToOpen,
  nextStatuses,
  scoringAdapters,
  slugify,
  toGameAvailability,
  toGameStatus,
  type EventDetailsInput,
  type TournamentGameInput,
  type TournamentStatus,
} from "@/features/event/domain/event-settings";
import { findCurrentTournamentId } from "./event-queries";

export class EventSettingsError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "EventSettingsError";
  }
}

export async function createTournament(input: {
  actorId: string;
  name: string;
  year: number;
}) {
  return getDatabase().transaction(async (tx) => {
    // Serialize creation so two admins cannot start parallel tournaments.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('ndcak:create-tournament'))`,
    );

    if (await findCurrentTournamentId(tx)) {
      throw new EventSettingsError("tournament_exists");
    }

    const baseSlug = slugify(`${input.name}-${input.year}`) || "tournament";
    const [taken] = await tx
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.slug, baseSlug))
      .limit(1);
    const slug = taken
      ? `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`
      : baseSlug;

    const [tournament] = await tx
      .insert(tournaments)
      .values({ name: input.name, year: input.year, slug })
      .returning({ id: tournaments.id });

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "TOURNAMENT_CREATED",
      entityType: "tournament",
      entityId: tournament.id,
      after: { name: input.name, year: input.year, slug, status: "DRAFT" },
    });

    return tournament.id;
  });
}

export async function updateEventDetails(input: {
  actorId: string;
  tournamentId: string;
  details: EventDetailsInput;
}) {
  const { details } = input;

  return getDatabase().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, input.tournamentId))
      .limit(1)
      .for("update");

    if (!before || before.status === "ARCHIVED") {
      throw new EventSettingsError("tournament_not_found");
    }
    if (
      before.status === "REGISTRATION_OPEN" &&
      (!details.venue ||
        !details.startsAt ||
        !details.endsAt ||
        !details.registrationCloseAt)
    ) {
      throw new EventSettingsError("required_while_open");
    }

    const after = {
      name: details.name,
      year: details.year,
      venue: details.venue,
      startsAt: details.startsAt,
      endsAt: details.endsAt,
      registrationOpenAt: details.registrationOpenAt,
      registrationCloseAt: details.registrationCloseAt,
      maxGamesPerParticipant: details.maxGamesPerParticipant,
      publicSettings: {
        ...before.publicSettings,
        description: details.description ?? undefined,
        checkInInstructions: details.checkInInstructions ?? undefined,
        departments: details.departments,
        academicYears: details.academicYears,
        resultsEnabled: details.resultsEnabled,
      },
    };

    await tx
      .update(tournaments)
      .set({ ...after, updatedAt: new Date() })
      .where(eq(tournaments.id, input.tournamentId));

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "TOURNAMENT_UPDATED",
      entityType: "tournament",
      entityId: input.tournamentId,
      before: snapshotTournament(before),
      after: snapshotTournament({ ...before, ...after }),
    });
  });
}

export async function changeTournamentStatus(input: {
  actorId: string;
  tournamentId: string;
  status: TournamentStatus;
}) {
  return getDatabase().transaction(async (tx) => {
    const [tournament] = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, input.tournamentId))
      .limit(1)
      .for("update");

    if (!tournament) throw new EventSettingsError("tournament_not_found");
    if (!nextStatuses(tournament.status).includes(input.status)) {
      throw new EventSettingsError("invalid_status_change");
    }

    if (input.status === "REGISTRATION_OPEN") {
      const [eventGames, methods] = await Promise.all([
        tx
          .select({
            status: tournamentGames.status,
            registrationOpen: tournamentGames.registrationOpen,
            feeMinor: tournamentGames.feeMinor,
          })
          .from(tournamentGames)
          .where(eq(tournamentGames.tournamentId, tournament.id)),
        tx
          .select({ value: count() })
          .from(paymentMethods)
          .where(
            and(
              eq(paymentMethods.tournamentId, tournament.id),
              eq(paymentMethods.enabled, true),
            ),
          ),
      ]);
      const checks = evaluateReadiness({
        now: new Date(),
        venue: tournament.venue,
        startsAt: tournament.startsAt,
        endsAt: tournament.endsAt,
        registrationCloseAt: tournament.registrationCloseAt,
        checkInInstructions:
          tournament.publicSettings.checkInInstructions ?? null,
        games: eventGames.map((game) => ({
          feeMinor: game.feeMinor,
          availability: toGameAvailability(game.status, game.registrationOpen),
        })),
        enabledPaymentMethods: methods[0].value,
      });

      if (!isReadyToOpen(checks)) throw new EventSettingsError("not_ready");
    }

    await tx
      .update(tournaments)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(tournaments.id, tournament.id));

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "TOURNAMENT_STATUS_CHANGED",
      entityType: "tournament",
      entityId: tournament.id,
      before: { status: tournament.status },
      after: { status: input.status },
    });
  });
}

export async function addTournamentGame(input: {
  actorId: string;
  tournamentId: string;
  name: string;
  scoringAdapter: TournamentGameInput["scoringAdapter"];
  feeTaka: number;
  capacity: number;
}) {
  return getDatabase().transaction(async (tx) => {
    const [tournament] = await tx
      .select({ status: tournaments.status })
      .from(tournaments)
      .where(eq(tournaments.id, input.tournamentId))
      .limit(1);

    if (!tournament || tournament.status === "ARCHIVED") {
      throw new EventSettingsError("tournament_not_found");
    }

    const [existing] = await tx
      .select({ id: games.id })
      .from(games)
      .where(sql`lower(${games.name}) = ${input.name.toLowerCase()}`)
      .limit(1);
    const [catalogGame] = existing
      ? [existing]
      : await tx
          .insert(games)
          .values({ name: input.name, slug: slugify(input.name) || "game" })
          .returning({ id: games.id });

    const adapter = scoringAdapters.find(
      (item) => item.key === input.scoringAdapter,
    );
    const [{ value: position }] = await tx
      .select({ value: count() })
      .from(tournamentGames)
      .where(eq(tournamentGames.tournamentId, input.tournamentId));

    const values = {
      feeMinor: input.feeTaka * 100,
      capacity: input.capacity,
      scoringAdapter: input.scoringAdapter,
      progressionMode: adapter?.progression ?? "MANUAL",
      sortOrder: (position + 1) * 10,
    };
    // An archived game has no registration history, so adding it again
    // revives the same row as a fresh draft.
    const [created] = await tx
      .insert(tournamentGames)
      .values({
        tournamentId: input.tournamentId,
        gameId: catalogGame.id,
        ...values,
      })
      .onConflictDoUpdate({
        target: [tournamentGames.tournamentId, tournamentGames.gameId],
        set: {
          ...values,
          status: "DRAFT",
          registrationOpen: false,
          updatedAt: new Date(),
        },
        setWhere: eq(tournamentGames.status, "ARCHIVED"),
      })
      .returning({ id: tournamentGames.id });

    if (!created) throw new EventSettingsError("game_exists");

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "TOURNAMENT_GAME_ADDED",
      entityType: "tournament_game",
      entityId: created.id,
      after: {
        name: input.name,
        feeMinor: input.feeTaka * 100,
        capacity: input.capacity,
        scoringAdapter: input.scoringAdapter,
        status: "DRAFT",
      },
    });

    return created.id;
  });
}

export async function updateTournamentGame(input: {
  actorId: string;
  tournamentGameId: string;
  config: TournamentGameInput;
}) {
  const { config } = input;

  return getDatabase().transaction(async (tx) => {
    const [before] = await tx
      .select({
        tournamentGame: tournamentGames,
        description: games.description,
      })
      .from(tournamentGames)
      .innerJoin(games, eq(tournamentGames.gameId, games.id))
      .where(eq(tournamentGames.id, input.tournamentGameId))
      .limit(1)
      .for("update", { of: tournamentGames });

    if (!before || before.tournamentGame.status === "ARCHIVED") {
      throw new EventSettingsError("game_not_found");
    }

    const taken =
      before.tournamentGame.reservedCount +
      before.tournamentGame.confirmedCount;
    if (config.capacity < taken) {
      throw new EventSettingsError("capacity_below_taken");
    }

    const status = toGameStatus(config.availability);
    const after = {
      feeMinor: config.feeTaka * 100,
      capacity: config.capacity,
      scoringAdapter: config.scoringAdapter,
      progressionMode: config.progressionMode,
      rules: config.rules,
      sortOrder: config.sortOrder,
      ...status,
    };

    await tx
      .update(tournamentGames)
      .set({ ...after, updatedAt: new Date() })
      .where(eq(tournamentGames.id, input.tournamentGameId));
    await tx
      .update(games)
      .set({ description: config.description, updatedAt: new Date() })
      .where(eq(games.id, before.tournamentGame.gameId));

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "TOURNAMENT_GAME_UPDATED",
      entityType: "tournament_game",
      entityId: input.tournamentGameId,
      before: {
        feeMinor: before.tournamentGame.feeMinor,
        capacity: before.tournamentGame.capacity,
        scoringAdapter: before.tournamentGame.scoringAdapter,
        progressionMode: before.tournamentGame.progressionMode,
        status: before.tournamentGame.status,
        registrationOpen: before.tournamentGame.registrationOpen,
        sortOrder: before.tournamentGame.sortOrder,
        description: before.description,
        rules: before.tournamentGame.rules,
      },
      after: { ...after, description: config.description },
    });
  });
}

export async function archiveTournamentGame(input: {
  actorId: string;
  tournamentGameId: string;
}) {
  return getDatabase().transaction(async (tx) => {
    const [game] = await tx
      .select({ status: tournamentGames.status })
      .from(tournamentGames)
      .where(eq(tournamentGames.id, input.tournamentGameId))
      .limit(1)
      .for("update");

    if (!game || game.status === "ARCHIVED") {
      throw new EventSettingsError("game_not_found");
    }

    // Games with any registration history stay for audit; close them instead.
    const [{ value: entries }] = await tx
      .select({ value: count() })
      .from(registrationGameEntries)
      .where(
        eq(registrationGameEntries.tournamentGameId, input.tournamentGameId),
      );
    if (entries > 0) throw new EventSettingsError("game_has_entries");

    await tx
      .update(tournamentGames)
      .set({
        status: "ARCHIVED",
        registrationOpen: false,
        updatedAt: new Date(),
      })
      .where(eq(tournamentGames.id, input.tournamentGameId));

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "TOURNAMENT_GAME_ARCHIVED",
      entityType: "tournament_game",
      entityId: input.tournamentGameId,
      before: { status: game.status },
      after: { status: "ARCHIVED" },
    });
  });
}

export async function savePaymentMethod(input: {
  actorId: string;
  tournamentId: string;
  paymentMethodId: string | null;
  method: {
    displayName: string;
    receivingAccount: string;
    instructions: string | null;
    enabled: boolean;
    sortOrder: number;
  };
}) {
  return getDatabase().transaction(async (tx) => {
    if (!input.paymentMethodId) {
      // The provider key identifies transactions for duplicate checks, so it
      // is derived once at creation and never changes afterwards.
      const provider = input.method.displayName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40);

      const [created] = await tx
        .insert(paymentMethods)
        .values({ tournamentId: input.tournamentId, provider, ...input.method })
        .onConflictDoNothing()
        .returning({ id: paymentMethods.id });

      if (!created) throw new EventSettingsError("payment_method_exists");

      await tx.insert(auditLogs).values({
        actorStaffId: input.actorId,
        action: "PAYMENT_METHOD_CREATED",
        entityType: "payment_method",
        entityId: created.id,
        after: { provider, ...input.method },
      });
      return;
    }

    const [before] = await tx
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.id, input.paymentMethodId),
          eq(paymentMethods.tournamentId, input.tournamentId),
        ),
      )
      .limit(1)
      .for("update");

    if (!before) throw new EventSettingsError("payment_method_not_found");

    await tx
      .update(paymentMethods)
      .set({ ...input.method, updatedAt: new Date() })
      .where(eq(paymentMethods.id, before.id));

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "PAYMENT_METHOD_UPDATED",
      entityType: "payment_method",
      entityId: before.id,
      before: {
        displayName: before.displayName,
        receivingAccount: before.receivingAccount,
        instructions: before.instructions,
        enabled: before.enabled,
        sortOrder: before.sortOrder,
      },
      after: input.method,
    });
  });
}

function snapshotTournament(tournament: typeof tournaments.$inferSelect) {
  return {
    name: tournament.name,
    year: tournament.year,
    venue: tournament.venue,
    startsAt: tournament.startsAt?.toISOString() ?? null,
    endsAt: tournament.endsAt?.toISOString() ?? null,
    registrationOpenAt: tournament.registrationOpenAt?.toISOString() ?? null,
    registrationCloseAt: tournament.registrationCloseAt?.toISOString() ?? null,
    maxGamesPerParticipant: tournament.maxGamesPerParticipant,
    publicSettings: tournament.publicSettings,
  };
}
