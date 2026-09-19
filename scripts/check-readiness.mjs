import { createTransport } from "nodemailer";
import postgres from "postgres";

const env = process.env;
const checks = {
  appUrl: Boolean(
    env.NEXT_PUBLIC_APP_URL &&
    !env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost"),
  ),
  secretKey: Boolean(env.SUPABASE_SECRET_KEY),
  cronSecret: Boolean(env.CRON_SECRET && env.CRON_SECRET.length >= 16),
  liveUpdates: false,
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
  "Daily job secret",
  checks.cronSecret,
  checks.cronSecret
    ? "CRON_SECRET is set"
    : "set CRON_SECRET (16+ random characters) so reminders and the keep-alive run",
);
report(
  "Invitation URL",
  checks.appUrl,
  checks.appUrl
    ? env.NEXT_PUBLIC_APP_URL
    : "set NEXT_PUBLIC_APP_URL to the https://….vercel.app address; localhost links only work on this computer",
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
        (select count(*)::int from public.registration_game_entries) as entries,
        (select count(*)::int from pg_policies where schemaname = 'realtime' and tablename = 'messages' and policyname = 'Active staff receive live updates') as live_policy
    `;

    checks.adminAuthUser = counts.admin_auth_users > 0;
    checks.adminProfile = counts.admin_profiles > 0;
    checks.tournament = counts.tournaments > 0;
    checks.game = counts.games > 0;
    checks.paymentMethod = counts.payment_methods > 0;
    checks.round = counts.rounds > 0;
    checks.match = counts.matches > 0;
    checks.participantEntry = counts.entries > 0;
    checks.liveUpdates = counts.live_policy > 0;

    report("Confirmed Super Admin Auth user", checks.adminAuthUser);
    report("Active Super Admin profile", checks.adminProfile);
    report(
      "Live updates access rule",
      checks.liveUpdates,
      checks.liveUpdates ? "" : "run pnpm db:migrate",
    );
    report(
      "Event data",
      checks.tournament && checks.game && checks.paymentMethod,
      `${counts.tournaments} tournaments, ${counts.games} games, ${counts.payment_methods} payment methods, ${counts.entries} entries`,
    );
  } catch {
    report("Live database check", false, "connection or query failed");
  } finally {
    await db.end();
  }
} else {
  report("Live database check", false, "DATABASE_URL is missing");
}

// Logs in to the SMTP server without sending a message.
try {
  const port = Number(env.SMTP_PORT ?? 465);
  await createTransport({
    host: env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: {
      user: env.SMTP_USER,
      pass: (env.SMTP_PASSWORD ?? "").replace(/\s+/g, ""),
    },
  }).verify();
  checks.verifiedSender = true;
} catch {
  console.error("SMTP login failed. Check SMTP_USER and SMTP_PASSWORD.");
}
report(
  "Gmail SMTP sign-in",
  checks.verifiedSender,
  env.SMTP_USER ?? "SMTP_USER is missing",
);

const inviteReady =
  checks.appUrl &&
  checks.secretKey &&
  checks.adminAuthUser &&
  checks.adminProfile &&
  checks.verifiedSender;
const eventConfigured =
  checks.tournament && checks.game && checks.paymentMethod;

console.log(
  `\nEmail and staff invitations: ${inviteReady ? "READY" : "BLOCKED"}`,
);
console.log(
  `Event configuration: ${eventConfigured ? "PRESENT" : "NOT ENTERED YET (use /admin/event)"}`,
);
console.log(
  `Live updates and daily jobs: ${checks.liveUpdates && checks.secretKey && checks.cronSecret ? "READY" : "BLOCKED"}`,
);

if (!inviteReady) process.exitCode = 1;
