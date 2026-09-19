// Copies the production settings from .env.local to the linked Vercel
// project. Values go to the Vercel CLI through stdin and are never printed.
//
//   pnpm vercel:env                 push every setting below
//   pnpm vercel:env SMTP_PASSWORD   push only the named ones
//
// Then redeploy (vercel deploy --prod) so the new values take effect.
// NEXT_PUBLIC_APP_URL is deliberately left out: on Vercel the app uses the
// production address automatically (see docs/operations/DEPLOYMENT.md).
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const settings = {
  DATABASE_URL: { sensitive: true },
  NEXT_PUBLIC_SUPABASE_URL: { sensitive: false },
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: { sensitive: false },
  SUPABASE_SECRET_KEY: { sensitive: true },
  SUPER_ADMIN_EMAIL: { sensitive: false },
  EMAIL_REPLY_TO: { sensitive: false },
  SMTP_USER: { sensitive: false },
  SMTP_PASSWORD: { sensitive: true },
  CRON_SECRET: { sensitive: true },
};

const values = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
}

const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(settings);
for (const name of names) {
  if (!settings[name]) throw new Error(`${name} is not a production setting.`);
  if (!values[name]) throw new Error(`${name} is missing from .env.local.`);
}

for (const name of names) {
  execFileSync(
    "vercel",
    [
      "env",
      "add",
      name,
      "production",
      "--force",
      ...(settings[name].sensitive ? ["--sensitive"] : []),
    ],
    { input: values[name], stdio: ["pipe", "ignore", "pipe"] },
  );
  console.log(`Set ${name}${settings[name].sensitive ? " (sensitive)" : ""}`);
}
