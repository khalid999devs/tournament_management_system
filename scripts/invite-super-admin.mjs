import { createClient } from "@supabase/supabase-js";
import { createTransport } from "nodemailer";
import postgres from "postgres";

const env = process.env;
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPER_ADMIN_EMAIL",
  "NEXT_PUBLIC_APP_URL",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "EMAIL_REPLY_TO",
];

for (const name of required) {
  if (!env[name]) throw new Error(`${name} is required.`);
}

const databaseUrl = env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL;
if (!databaseUrl) throw new Error("A database URL is required.");

const email = env.SUPER_ADMIN_EMAIL.toLowerCase();
const auth = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
).auth.admin;

const invite = await auth.generateLink({ type: "invite", email });
const link = invite.error
  ? await auth.generateLink({ type: "recovery", email })
  : invite;

if (link.error || !link.data.properties.hashed_token) {
  throw new Error("Could not create the Admin setup link.");
}

const database = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
});

try {
  const [user] = await database`
    select id
    from auth.users
    where lower(email) = ${email}
    limit 1
  `;

  if (!user) throw new Error("The Admin Auth user was not found.");

  await database`
    insert into public.staff_profiles (
      auth_user_id, email, role, display_name, active
    ) values (
      ${user.id}, ${email}, 'SUPER_ADMIN', 'NDCAK Super Admin', true
    )
    on conflict (auth_user_id) do update
    set role = excluded.role,
        email = excluded.email,
        display_name = excluded.display_name,
        active = true,
        updated_at = now()
  `;
} finally {
  await database.end();
}

const actionUrl = new URL("/auth/confirm", env.NEXT_PUBLIC_APP_URL);
actionUrl.searchParams.set("token_hash", link.data.properties.hashed_token);
actionUrl.searchParams.set("type", invite.error ? "recovery" : "invite");

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
          <p style="font-size:16px;line-height:1.6">Your NDCAK Super Admin account has been created. Open this time-limited link, then choose a strong password.</p>
          <a href="${escapedUrl}" style="display:inline-block;margin:14px 0 22px;padding:15px 22px;background:#0d1b39;color:#fff;text-decoration:none;font-weight:700">Set up your account →</a>
          <p style="font-size:13px;line-height:1.6;color:#59657a">If you did not request this setup, ignore this email. Need help? Reply to ${env.EMAIL_REPLY_TO}.</p>
        </div>
      </div>
    </div>`,
});

console.log("Super Admin account and profile are ready. Setup email sent.");
