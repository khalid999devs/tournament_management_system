import postgres from "postgres";
import { Resend } from "resend";

const env = process.env;
const checks = {
  appUrl: Boolean(env.NEXT_PUBLIC_APP_URL),
  secretKey: Boolean(env.SUPABASE_SECRET_KEY),
  adminAuthUser: false,
  adminProfile: false,
  verifiedSender: false,
  tournament: false,
  game: false,
  paymentMethod: false,
  round: false,
  match: false,
  participantEntry: false,
};

function report(label, ready, detail = "") {
  console.log(
    `${ready ? "READY" : "PENDING"}  ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

report("Server-only Supabase key", checks.secretKey);
report(
  "Invitation URL",
  checks.appUrl,
  env.NEXT_PUBLIC_APP_URL?.startsWith("http://localhost")
    ? "localhost links work only on the same computer"
    : "check that operators can open this URL",
);

const databaseUrl = env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL;

if (databaseUrl) {
  const db = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ssl: "require",
    connect_timeout: 10,
  });

  try {
    const [counts] = await db`
      select
        (select count(*)::int from auth.users where lower(email) = lower(${env.SUPER_ADMIN_EMAIL ?? ""}) and email_confirmed_at is not null) as admin_auth_users,
        (select count(*)::int from public.staff_profiles where lower(email) = lower(${env.SUPER_ADMIN_EMAIL ?? ""}) and role = 'SUPER_ADMIN' and active) as admin_profiles,
        (select count(*)::int from public.tournaments) as tournaments,
        (select count(*)::int from public.tournament_games) as games,
        (select count(*)::int from public.payment_methods) as payment_methods,
        (select count(*)::int from public.rounds) as rounds,
        (select count(*)::int from public.matches) as matches,
        (select count(*)::int from public.registration_game_entries) as entries
    `;

    checks.adminAuthUser = counts.admin_auth_users > 0;
    checks.adminProfile = counts.admin_profiles > 0;
    checks.tournament = counts.tournaments > 0;
    checks.game = counts.games > 0;
    checks.paymentMethod = counts.payment_methods > 0;
    checks.round = counts.rounds > 0;
    checks.match = counts.matches > 0;
    checks.participantEntry = counts.entries > 0;

    report("Confirmed Super Admin Auth user", checks.adminAuthUser);
    report("Active Super Admin profile", checks.adminProfile);
    report(
      "Scope-test data",
      checks.tournament &&
        checks.game &&
        checks.paymentMethod &&
        checks.round &&
        checks.match &&
        checks.participantEntry,
      `${counts.tournaments} tournaments, ${counts.games} games, ${counts.payment_methods} payment methods, ${counts.rounds} rounds, ${counts.matches} matches, ${counts.entries} entries`,
    );
  } catch {
    report("Live database check", false, "connection or query failed");
  } finally {
    await db.end();
  }
} else {
  report("Live database check", false, "DATABASE_URL is missing");
}

const senderAddress =
  env.EMAIL_FROM?.match(/<([^<>]+)>$/)?.[1] ?? env.EMAIL_FROM;
const senderDomain = senderAddress?.split("@")[1]?.toLowerCase();

if (env.RESEND_API_KEY) {
  try {
    const { data, error } = await new Resend(env.RESEND_API_KEY).domains.list();

    if (!error) {
      checks.verifiedSender = Boolean(
        data?.data?.some(
          (domain) =>
            domain.status === "verified" &&
            domain.name.toLowerCase() === senderDomain,
        ),
      );
    } else {
      console.error("Resend domain lookup failed.");
    }
  } catch {
    console.error("Resend domain lookup failed.");
  }
}

report("Verified Resend sender domain", checks.verifiedSender);

const inviteReady =
  checks.appUrl &&
  checks.secretKey &&
  checks.adminAuthUser &&
  checks.adminProfile &&
  checks.verifiedSender;
const scopeReady =
  checks.tournament &&
  checks.game &&
  checks.paymentMethod &&
  checks.round &&
  checks.match &&
  checks.participantEntry;

console.log(
  `\nStaff invitation rehearsal: ${inviteReady ? "READY" : "BLOCKED"}`,
);
console.log(
  `Full assignment-scope rehearsal: ${inviteReady && scopeReady ? "READY" : "BLOCKED"}`,
);

if (!inviteReady || !scopeReady) process.exitCode = 1;
