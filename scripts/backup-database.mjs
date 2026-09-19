// Saves the event data (the public schema and the migration journal) to
// backups/ as a pg_dump custom-format file, with row counts beside it so a
// restore can be checked. Needs pg_dump 17 or newer on this computer.
//
// The file holds participant contact details. Keep it private, never commit
// it, and delete old copies once the event is over.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const raw =
  process.env.BACKUP_DATABASE_URL ??
  process.env.MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL is required.");

// pg_dump needs a session connection. Supabase's transaction pooler (port
// 6543) cannot give one; its session pooler on the same host (5432) can.
const url = new URL(raw);
if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543") {
  url.port = "5432";
}
const password = decodeURIComponent(url.password);
url.password = "";
const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
if (!local && !url.searchParams.has("sslmode")) {
  url.searchParams.set("sslmode", "require");
}

// Named in Dhaka time, e.g. ndcak-2026-11-06-0830.dump.
const stamp = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})
  .format(new Date())
  .replace(", ", "-")
  .replace(":", "");
const dir = path.resolve("backups");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const file = path.join(dir, `ndcak-${stamp}.dump`);

const sql = postgres({
  host: url.hostname,
  port: Number(url.port || 5432),
  database: url.pathname.slice(1),
  username: decodeURIComponent(url.username),
  password,
  ssl: local ? false : "require",
  max: 1,
  prepare: false,
});
let counts = {};
try {
  const tables = await sql`
    select tablename from pg_tables where schemaname = 'public' order by tablename`;
  for (const { tablename } of tables) {
    const [row] =
      await sql`select count(*)::int as n from public.${sql(tablename)}`;
    counts[tablename] = row.n;
  }
} finally {
  await sql.end();
}

execFileSync(
  "pg_dump",
  [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--schema=public",
    "--schema=drizzle",
    `--file=${file}`,
    url.toString(),
  ],
  {
    env: { ...process.env, PGPASSWORD: password },
    stdio: ["ignore", "inherit", "inherit"],
  },
);
fs.chmodSync(file, 0o600);
fs.writeFileSync(
  `${file}.json`,
  JSON.stringify({ createdAt: new Date().toISOString(), counts }, null, 2),
);

const listing = execFileSync("pg_restore", ["--list", file]).toString();
const dataEntries = listing
  .split("\n")
  .filter((line) => line.includes(" TABLE DATA ")).length;
const rows = Object.values(counts).reduce((sum, n) => sum + n, 0);
console.log(
  `Saved ${path.relative(process.cwd(), file)} (${Math.round(fs.statSync(file).size / 1024)} KB): ${dataEntries} tables, ${rows} rows.`,
);
console.log(
  "Check it with: pnpm db:verify-backup " + path.relative(process.cwd(), file),
);
