// Restores a backup into a throwaway local database and checks that every
// table has the row count recorded when the backup was made.
//
//   pnpm db:verify-backup backups/ndcak-<stamp>.dump
//
// Uses VERIFY_DATABASE_URL (default: a local server on port 55432) and drops
// the scratch database afterwards unless --keep is given.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import postgres from "postgres";

const file = process.argv[2];
const keep = process.argv.includes("--keep");
if (!file || !fs.existsSync(file)) {
  throw new Error("Usage: pnpm db:verify-backup backups/<file>.dump");
}
const expected = JSON.parse(fs.readFileSync(`${file}.json`, "utf8")).counts;

const target = new URL(
  process.env.VERIFY_DATABASE_URL ??
    "postgresql://postgres@127.0.0.1:55432/ndcak_restore_check",
);
if (!["localhost", "127.0.0.1", "::1"].includes(target.hostname)) {
  throw new Error("Restore checks only run against a local database.");
}
const name = target.pathname.slice(1);
const admin = postgres({
  host: target.hostname,
  port: Number(target.port || 5432),
  username: decodeURIComponent(target.username || "postgres"),
  password: decodeURIComponent(target.password || ""),
  database: "postgres",
  max: 1,
  onnotice: () => {},
});
await admin.unsafe(`drop database if exists "${name}"`);
await admin.unsafe(`create database "${name}"`);

// Every new database already has a public schema, so the restore skips the
// dump's CREATE SCHEMA entry (the same list works for a real restore).
const listFile = `${file}.restore-list`;
fs.writeFileSync(
  listFile,
  execFileSync("pg_restore", ["--list", file])
    .toString()
    .split("\n")
    .filter((line) => !/ SCHEMA - public /.test(line))
    .join("\n"),
);

try {
  execFileSync(
    "pg_restore",
    [
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      `--use-list=${listFile}`,
      `--dbname=${target}`,
      file,
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  const restored = postgres(target.toString(), { max: 1 });
  const problems = [];
  try {
    for (const [table, count] of Object.entries(expected)) {
      const [row] =
        await restored`select count(*)::int as n from public.${restored(table)}`;
      if (row.n !== count)
        problems.push(`${table}: expected ${count}, restored ${row.n}`);
    }
    const [migrations] =
      await restored`select count(*)::int as n from drizzle.__drizzle_migrations`;
    console.log(`Migrations recorded: ${migrations.n}`);
  } finally {
    await restored.end();
  }
  const tables = Object.keys(expected).length;
  const rows = Object.values(expected).reduce((sum, n) => sum + n, 0);
  if (problems.length) {
    console.error(`Restore check FAILED:\n${problems.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Restore check passed: ${tables} tables, ${rows} rows match the backup.`,
    );
  }
} finally {
  fs.rmSync(listFile, { force: true });
  if (!keep) await admin.unsafe(`drop database if exists "${name}"`);
  await admin.end();
}
