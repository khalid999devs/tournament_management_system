// Seeds the end-to-end database through the app's own services, so the data
// obeys the same rules as real use. Run by global-setup through Vitest (which
// resolves the @ alias and server-only), never on its own.
import fs from "node:fs";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  notifications,
  registrationGameEntries,
  registrations,
  staffProfiles,
} from "@/db/schema";
import { reviewRegistration } from "@/features/admin/server/review-registration";
import { eventDetailsSchema } from "@/features/event/domain/event-settings";
import {
  addTournamentGame,
  changeTournamentStatus,
  createTournament,
  savePaymentMethod,
  updateEventDetails,
  updateScoringRules,
  updateTournamentGame,
} from "@/features/event/server/manage-event";
import {
  addManualMatch,
  addRound,
  generateBracket,
} from "@/features/matches/server/manage-brackets";
import { grantOperatorAssignment } from "@/features/operators/server/manage-operators";
import { submitRegistration } from "@/features/registration/server/submit-registration";
import type { ScoringAdapterKey } from "@/features/scoring/adapters";
import { resetDatabase } from "../../integration/helpers";
import type { Role, RunManifest } from "./paths";

const users = JSON.parse(process.env.E2E_USERS ?? "{}") as RunManifest["users"];
const manifestPath = process.env.E2E_MANIFEST!;

const departments = [
  "Civil Engineering",
  "Computer Science and Engineering",
  "Electrical and Electronic Engineering",
  "Mechanical Engineering",
  "Urban and Regional Planning",
];

const firstNames = [
  "Ayesha",
  "Tanvir",
  "Nusrat",
  "Rafiq",
  "Farhana",
  "Imran",
  "Sadia",
  "Mahmud",
  "Tasnim",
  "Arif",
  "Sumaiya",
  "Rakib",
  "Lamia",
  "Shakil",
  "Jannat",
  "Fahim",
  "Mim",
  "Nafis",
  "Tahsin",
  "Riya",
];
const lastNames = [
  "Rahman",
  "Hossain",
  "Islam",
  "Ahmed",
  "Chowdhury",
  "Karim",
  "Sarker",
  "Haque",
  "Akter",
  "Uddin",
  "Siddiqui",
  "Talukder",
];

const rules: Record<string, string> = {
  Chess:
    "Format: Swiss rounds, then a knockout.\nTime control: 10 minutes plus 5 seconds a move.\nTouch-move applies.",
  "Table Tennis":
    "Matches are best of five games to 11, won by two clear points.\nService alternates every two points.",
  Carrom:
    "Singles, best of three boards.\nA board ends at 25 points or after eight rounds.",
  "Mobile Football":
    "eFootball, one against one, six-minute halves.\nKnockout draws go to extra time, then penalties.",
  "29 Cards":
    "Tables of four in fixed partnerships.\nThe highest total after the agreed hands wins the table.",
};

// Dhaka wall-clock time, in the datetime-local format the forms use.
const inDays = (days: number, hour = 10) => {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setUTCHours(hour - 6, 0, 0, 0);
  return new Date(date.getTime() + 6 * 3_600_000).toISOString().slice(0, 16);
};

let studentNumber = 0;

async function register(tournamentId: string, gameIds: string[]) {
  studentNumber += 1;
  const n = studentNumber;
  const first = firstNames[n % firstNames.length];
  const last = lastNames[(n * 7) % lastNames.length];
  const result = await submitRegistration({
    tournamentId,
    idempotencyKey: crypto.randomUUID(),
    details: {
      fullName: `${first} ${last}`,
      studentId: String(2_107_000 + n),
      email: `${first}.${last}.${n}@example.com`.toLowerCase(),
      phone: `017${String(10_000_000 + n * 7919).slice(0, 8)}`,
      department: departments[n % departments.length],
      academicYear: `${(n % 4) + 1}${["st", "nd", "rd", "th"][n % 4]} year`,
      selectedGameIds: gameIds,
    },
    paymentProvider: ["BKASH", "NAGAD", "ROCKET"][n % 3],
    transactionId: `${["BK", "NG", "RK"][n % 3]}${String(n).padStart(3, "0")}X${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
  });
  const [row] = await getDatabase()
    .select({ id: registrations.id })
    .from(registrations)
    .where(eq(registrations.code, result.registrationCode));
  return row.id;
}

async function entriesFor(registrationId: string) {
  return getDatabase()
    .select({
      id: registrationGameEntries.id,
      gameId: registrationGameEntries.tournamentGameId,
    })
    .from(registrationGameEntries)
    .where(eq(registrationGameEntries.registrationId, registrationId));
}

it("seeds the end-to-end event", async () => {
  expect(users.admin?.id).toBeTruthy();
  const db = getDatabase();
  await resetDatabase();

  const staff = {} as Record<Role, string>;
  for (const [role, user] of Object.entries(users) as [
    Role,
    RunManifest["users"][Role],
  ][]) {
    const [profile] = await db
      .insert(staffProfiles)
      .values({
        authUserId: user.id,
        email: user.email,
        displayName: user.name,
        role: role === "admin" ? "SUPER_ADMIN" : "SCORE_OPERATOR",
      })
      .returning({ id: staffProfiles.id });
    staff[role] = profile.id;
  }
  const actorId = staff.admin;

  const tournamentId = await createTournament({
    actorId,
    name: "NDCAK Indoor Games Championship",
    year: 2026,
  });
  await updateEventDetails({
    actorId,
    tournamentId,
    details: eventDetailsSchema.parse({
      name: "NDCAK Indoor Games Championship",
      year: "2026",
      venue: "KUET Student Welfare Centre, Khulna",
      description:
        "Five games, three days, one championship. Enter one game or several, and play for the title in each.",
      checkInInstructions:
        "Report to the registration desk 30 minutes before your first match. Bring your student ID card and your registration code.",
      startsAt: inDays(40, 9),
      endsAt: inDays(42, 18),
      registrationOpenAt: "",
      registrationCloseAt: inDays(30, 23),
      maxGamesPerParticipant: "3",
      departments: departments.join("\n"),
      academicYears: "1st year\n2nd year\n3rd year\n4th year",
      resultsEnabled: true,
    }),
  });

  for (const [index, [displayName, account]] of [
    ["bKash", "01711-000111 (Personal)"],
    ["Nagad", "01811-000222 (Personal)"],
    ["Rocket", "01911-0003334 (Personal)"],
  ].entries()) {
    await savePaymentMethod({
      actorId,
      tournamentId,
      paymentMethodId: null,
      method: {
        displayName,
        receivingAccount: account,
        instructions: `Use ${displayName} Send Money to this number, then enter the transaction ID from your receipt.`,
        enabled: true,
        sortOrder: index + 1,
      },
    });
  }

  const lineup: [string, ScoringAdapterKey, number, number, string][] = [
    ["Chess", "CHESS_OUTCOME", 50, 64, "Classical strategy over the board."],
    ["Table Tennis", "SETS", 70, 16, "Fast rallies and sharp finishes."],
    ["Carrom", "CARROM_POINTS", 60, 32, "Touch, angles and nerve."],
    ["Mobile Football", "GOALS", 50, 16, "Head-to-head on the pitch."],
    ["29 Cards", "MULTIPLAYER_POINTS", 80, 16, "Read the table, win the hand."],
  ];
  const games: Record<string, string> = {};
  for (const [
    index,
    [name, adapter, fee, capacity, description],
  ] of lineup.entries()) {
    const id = await addTournamentGame({
      actorId,
      tournamentId,
      name,
      scoringAdapter: adapter,
      feeTaka: fee,
      capacity,
    });
    await updateTournamentGame({
      actorId,
      tournamentGameId: id,
      config: {
        description,
        feeTaka: fee,
        capacity,
        availability: "OPEN",
        rules: rules[name],
        sortOrder: index + 1,
      },
    });
    games[name] = id;
  }
  await changeTournamentStatus({
    actorId,
    tournamentId,
    status: "REGISTRATION_OPEN",
  });

  const approve = (registrationId: string) =>
    reviewRegistration({
      registrationId,
      decision: "APPROVE",
      actorStaffId: actorId,
    });

  // Confirmed players for the three games that get draws.
  const confirmed: Record<string, string[]> = {
    "Table Tennis": [],
    "Mobile Football": [],
    "29 Cards": [],
  };
  for (const [game, count] of [
    ["Table Tennis", 4],
    ["Mobile Football", 8],
    ["29 Cards", 8],
  ] as const) {
    for (let index = 0; index < count; index += 1) {
      const registrationId = await register(tournamentId, [games[game]]);
      await approve(registrationId);
      const [entry] = await entriesFor(registrationId);
      confirmed[game].push(entry.id);
    }
  }

  // A realistic review queue for Chess and Carrom: more than one page.
  for (let index = 0; index < 30; index += 1) {
    const picks =
      index % 3 === 0
        ? [games.Chess, games.Carrom]
        : [index % 2 ? games.Chess : games.Carrom];
    const registrationId = await register(tournamentId, picks);
    if (index % 5 === 1) await approve(registrationId);
    if (index % 7 === 3) {
      await reviewRegistration({
        registrationId,
        decision: "REJECT",
        reason: "The transaction ID did not match a payment.",
        actorStaffId: actorId,
      });
    }
  }

  // Seeded mail counts as delivered, so the dashboard shows no warnings.
  await db.update(notifications).set({ status: "SENT", sentAt: new Date() });

  const close = async (name: string, capacity: number, index: number) =>
    updateTournamentGame({
      actorId,
      tournamentGameId: games[name],
      config: {
        description: lineup[index][4],
        feeTaka: lineup[index][2],
        capacity,
        availability: "CLOSED",
        rules: rules[name],
        sortOrder: index + 1,
      },
    });

  await close("Table Tennis", 16, 1);
  await updateScoringRules({
    actorId,
    tournamentGameId: games["Table Tennis"],
    scoringAdapter: "SETS",
    progressionMode: "AUTOMATIC_SINGLE_ELIMINATION",
    config: {},
  });
  await generateBracket({
    actorId,
    tournamentGameId: games["Table Tennis"],
    seeding: "RANDOM",
  });

  await close("Mobile Football", 16, 3);
  await updateScoringRules({
    actorId,
    tournamentGameId: games["Mobile Football"],
    scoringAdapter: "GOALS",
    progressionMode: "AUTOMATIC_SINGLE_ELIMINATION",
    config: {},
  });
  await generateBracket({
    actorId,
    tournamentGameId: games["Mobile Football"],
    seeding: "RANDOM",
  });

  await close("29 Cards", 16, 4);
  await updateScoringRules({
    actorId,
    tournamentGameId: games["29 Cards"],
    scoringAdapter: "MULTIPLAYER_POINTS",
    progressionMode: "MANUAL",
    config: {},
  });
  const round = await addRound({
    actorId,
    tournamentGameId: games["29 Cards"],
    name: "Round 1",
  });
  const cardsMatches: string[] = [];
  for (const table of [0, 1]) {
    const match = await addManualMatch({
      actorId,
      roundId: round,
      registrationGameEntryIds: confirmed["29 Cards"].slice(
        table * 4,
        table * 4 + 4,
      ),
      scheduledAt: null,
      station: `Table ${table + 1}`,
    });
    cardsMatches.push(match);
  }

  // Operator A covers table tennis and football; B only table tennis, so the
  // two overlap on the same matches.
  for (const [operator, gameNames] of [
    ["operatorA", ["Table Tennis", "Mobile Football", "29 Cards"]],
    ["operatorB", ["Table Tennis"]],
  ] as const) {
    for (const name of gameNames) {
      await grantOperatorAssignment({
        actorId,
        operatorId: staff[operator],
        tournamentId,
        scopeType: "GAME",
        targetId: games[name],
        capabilities: [
          "VIEW",
          "SCORE_UPDATE",
          "FINALIZE_MATCH",
          "ISSUE_REPORT",
        ],
      });
    }
  }

  const matchRows = await db.execute<{
    id: string;
    game: string;
    sequence: number;
  }>(sql`
    select m.id, r.tournament_game_id as game, r.sequence
    from matches m
    join rounds r on r.id = m.round_id
    order by r.sequence, m.code
  `);
  const tableTennis = matchRows.filter(
    (row) => row.game === games["Table Tennis"],
  );
  const football = matchRows.filter(
    (row) => row.game === games["Mobile Football"],
  );

  const manifest: Omit<RunManifest, "tag"> = {
    users,
    tournamentId,
    games,
    tableTennisMatches: {
      semiFinals: tableTennis
        .filter((row) => row.sequence === 1)
        .map((row) => row.id),
      final: tableTennis.find((row) => row.sequence === 2)!.id,
    },
    footballMatches: football.map((row) => row.id),
    cardsMatches,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  expect(manifest.tableTennisMatches.semiFinals).toHaveLength(2);
});
