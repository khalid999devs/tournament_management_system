// Gives a person Super Admin access, or gets a locked-out Super Admin back in.
// Creates the account if needed, makes sure the staff profile is an active
// Super Admin, and emails a time-limited link to set a new password.
//
//   pnpm db:invite-admin -- --url https://<site>.vercel.app
//   pnpm db:invite-admin -- --url https://<site>.vercel.app --email person@example.com --name "Full Name"
//   add --print to show the link here instead of emailing it (when email is down)
//
// Run it only from a trusted computer that has the project's .env.local.
import { createClient } from "@supabase/supabase-js";
import { createTransport } from "nodemailer";
import postgres from "postgres";

const env = process.env;
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const email = (option("email") ?? env.SUPER_ADMIN_EMAIL ?? "").toLowerCase();
const name = option("name") ?? "NDCAK Super Admin";
const siteUrl = option("url") ?? env.NEXT_PUBLIC_APP_URL;
const printOnly = args.includes("--print");

for (const [label, value] of [
  ["--email or SUPER_ADMIN_EMAIL", email],
  ["--url or NEXT_PUBLIC_APP_URL", siteUrl],
  ["NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL],
  ["SUPABASE_SECRET_KEY", env.SUPABASE_SECRET_KEY],
]) {
  if (!value) throw new Error(`${label} is required.`);
}
if (!printOnly && (!env.SMTP_USER || !env.SMTP_PASSWORD)) {
  throw new Error("SMTP_USER and SMTP_PASSWORD are required, or use --print.");
}
if (siteUrl.startsWith("http://localhost") && !args.includes("--local")) {
  console.warn(
    "Warning: the link will point at this computer. Pass --url with the live address.",
  );
}

const databaseUrl = env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL;
if (!databaseUrl) throw new Error("A database URL is required.");

const auth = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
).auth.admin;

// An invite creates the account; an existing account gets a recovery link.
const invite = await auth.generateLink({ type: "invite", email });
const link = invite.error
  ? await auth.generateLink({ type: "recovery", email })
  : invite;
if (link.error || !link.data.properties.hashed_token || !link.data.user?.id) {
  throw new Error("Could not create the setup link.");
}

const database = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : "require",
  connect_timeout: 10,
});
try {
  await database`
    insert into public.staff_profiles (auth_user_id, email, role, display_name, active)
    values (${link.data.user.id}, ${email}, 'SUPER_ADMIN', ${name}, true)
    on conflict (auth_user_id) do update
    set role = excluded.role,
        email = excluded.email,
        active = true,
        updated_at = now()
  `;
} finally {
  await database.end();
}

const actionUrl = new URL("/auth/confirm", siteUrl);
actionUrl.searchParams.set("token_hash", link.data.properties.hashed_token);
actionUrl.searchParams.set("type", invite.error ? "recovery" : "invite");

if (printOnly) {
  console.log(`Super Admin access is ready for ${email}.`);
  console.log("Open this link once, within the hour, to set a password:");
  console.log(actionUrl.toString());
  process.exit(0);
}

const escapedUrl = actionUrl.toString().replaceAll("&", "&amp;");
const port = Number(env.SMTP_PORT ?? 465);
await createTransport({
  host: env.SMTP_HOST ?? "smtp.gmail.com",
  port,
  secure: port === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD.replace(/\s+/g, "") },
}).sendMail({
  from: {
    name: env.EMAIL_FROM_NAME ?? "NDCAK Indoor Games",
    address: env.SMTP_USER,
  },
  to: email,
  replyTo: env.EMAIL_REPLY_TO,
  subject: "Set up your NDCAK Super Admin account",
  text: [
    "NDCAK staff account setup",
    "",
    "Your Super Admin account is ready. Open the time-limited link below, then choose a strong password.",
    "",
    actionUrl.toString(),
    "",
    "If you did not request this setup, ignore this email.",
    `Questions? Reply to ${env.EMAIL_REPLY_TO}.`,
  ].join("\n"),
  html: `
    <div style="margin:0;padding:32px 12px;background:#edf0f1;font-family:Arial,Helvetica,sans-serif;color:#17284d">
      <div style="max-width:600px;margin:0 auto;background:#fbfaf6">
        <div style="padding:28px 34px;background:#0d1b39;border-top:5px solid #e4c27a;color:#f6f1e6">
          <div style="font-size:11px;letter-spacing:1.5px;color:#c7cedb">NOTRE DAME COLLEGE ASSOCIATION OF KUET</div>
          <div style="margin-top:12px;font-size:32px;font-weight:800">NDCAK</div>
          <div style="font-size:11px;letter-spacing:2px;color:#e4c27a">INDOOR GAMES CHAMPIONSHIP</div>
        </div>
        <div style="padding:36px 34px 30px">
          <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#8a6934">STAFF ACCOUNT SETUP</div>
          <h1 style="margin:10px 0 18px;font-size:30px;line-height:1.2;color:#071127">Your workspace is ready.</h1>
          <p style="font-size:16px;line-height:1.6">Your NDCAK Super Admin account is ready. Open this time-limited link, then choose a strong password.</p>
          <a href="${escapedUrl}" style="display:inline-block;margin:14px 0 22px;padding:15px 22px;background:#0d1b39;color:#fff;text-decoration:none;font-weight:700">Set up your account →</a>
          <p style="font-size:13px;line-height:1.6;color:#59657a">If you did not request this setup, ignore this email. Need help? Reply to ${env.EMAIL_REPLY_TO}.</p>
        </div>
      </div>
    </div>`,
});

console.log(`Super Admin access is ready for ${email}. Setup email sent.`);
