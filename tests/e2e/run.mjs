// End-to-end runner: prepares a local database, seeds it through the app's
// services, builds and starts the production server against it, runs
// Playwright, then cleans up.
//
// Staff sign-in uses the real Supabase Auth project with throwaway accounts
// (e2e-*@example.com) that are deleted at the end. Every other setting the
// server would read from .env.local is overridden, so a run can never touch
// the live database or send real email.
//
//   pnpm test:e2e                 full run
//   pnpm test:e2e --keep          leave server, mail sink and accounts up
//   pnpm test:e2e --reuse [args]  run tests against a kept setup
//   Extra arguments go to Playwright, e.g. pnpm test:e2e -g "registration".
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const root = path.resolve(import.meta.dirname, "../..");
const outDir = path.join(root, "test-results/e2e");
const manifestPath = path.join(outDir, "run.json");
const keptPath = path.join(outDir, "kept.json");
const mailDir = path.join(outDir, "mail");
const port = 3100;
const port_app = 3100;
const port_smtp = 2526;
const baseUrl = `http://localhost:${port}`;

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const reuse = args.includes("--reuse");
const playwrightArgs = args.filter(
  (arg) => !["--keep", "--reuse"].includes(arg),
);

const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgresql://postgres@127.0.0.1:55432/ndcak_e2e";
if (
  !["localhost", "127.0.0.1", "::1"].includes(new URL(databaseUrl).hostname)
) {
  throw new Error(
    "E2E_DATABASE_URL must point at a local PostgreSQL database.",
  );
}

// Only the Supabase keys are taken from .env.local.
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}
const local = readEnvFile(path.join(root, ".env.local"));
const inherited = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
];
for (const name of inherited) {
  if (!process.env[name] && !local[name])
    throw new Error(`${name} is required.`);
}
const supabase = Object.fromEntries(
  inherited.map((name) => [name, process.env[name] ?? local[name]]),
);
const authAdmin = createClient(
  supabase.NEXT_PUBLIC_SUPABASE_URL,
  supabase.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
).auth.admin;

const overrides = {
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: databaseUrl,
  MIGRATION_DATABASE_URL: databaseUrl,
  NEXT_PUBLIC_APP_URL: baseUrl,
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "2526",
  SMTP_USER: "sender@example.com",
  SMTP_PASSWORD: "e2e-sink-password",
  EMAIL_REPLY_TO: "help@example.com",
  CRON_SECRET: "e2e-cron-secret-0000000000",
  SUPER_ADMIN_EMAIL: "admin@example.com",
};
// next build/start also read .env.local, but only for names not already set,
// so every name in it must be overridden or deliberately inherited.
const uncovered = Object.keys(local).filter(
  (name) => !inherited.includes(name) && !(name in overrides),
);
if (uncovered.length) {
  throw new Error(`Add E2E values for: ${uncovered.join(", ")}`);
}
const serverEnv = { ...process.env, ...supabase, ...overrides };

const children = [];
function start(command, commandArgs, options = {}) {
  const child = spawn(command, commandArgs, {
    cwd: root,
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    ...options,
  });
  children.push(child);
  return child;
}

async function waitFor(url, timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${url} did not come up.`);
}

async function deleteTestUsers() {
  let removed = 0;
  for (let page = 1; page < 20; page += 1) {
    const { data, error } = await authAdmin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const stale = data.users.filter((user) =>
      /^e2e-[a-z0-9-]+@example\.com$/.test(user.email ?? ""),
    );
    for (const user of stale) {
      await authAdmin.deleteUser(user.id);
      removed += 1;
    }
    if (data.users.length < 200) break;
  }
  return removed;
}

// Runs a command to completion; on failure prints its output as text.
function runStep(command, commandArgs, env) {
  try {
    execFileSync(command, commandArgs, { cwd: root, env, stdio: "pipe" });
  } catch (error) {
    process.stderr.write(
      String(error.stdout ?? "") + String(error.stderr ?? ""),
    );
    throw new Error(`${command} ${commandArgs.join(" ")} failed.`);
  }
}

// A previous run (or a kept setup whose notes were deleted) can still hold the
// ports; without this the tests would quietly use the old server.
function freePorts() {
  for (const port of [port_app, port_smtp]) {
    try {
      const pids = execFileSync("lsof", ["-ti", `tcp:${port}`], {
        stdio: "pipe",
      })
        .toString()
        .split("\n")
        .filter(Boolean);
      for (const pid of pids) process.kill(Number(pid), "SIGTERM");
      if (pids.length) console.log(`Freed port ${port}.`);
    } catch {
      // nothing listening
    }
  }
}

function stopKept() {
  if (!fs.existsSync(keptPath)) return;
  for (const pid of JSON.parse(fs.readFileSync(keptPath, "utf8")).pids) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

async function prepare() {
  stopKept();
  freePorts();
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(mailDir, { recursive: true });

  const server = postgres({ ...parseAdmin(databaseUrl), max: 1 });
  const name = new URL(databaseUrl).pathname.slice(1);
  const [exists] =
    await server`select 1 from pg_database where datname = ${name}`;
  if (!exists) await server.unsafe(`create database "${name}"`);
  await server.end();
  runStep("pnpm", ["exec", "drizzle-kit", "migrate"], serverEnv);

  await deleteTestUsers();
  const tag = randomUUID().slice(0, 8);
  const users = {};
  const passwords = {};
  for (const [role, name] of [
    ["admin", "Nadia Rahman"],
    ["operatorA", "Operator Arif"],
    ["operatorB", "Operator Bina"],
  ]) {
    const email = `e2e-${role.toLowerCase()}-${tag}@example.com`;
    const password = randomBytes(18).toString("base64url");
    const { data, error } = await authAdmin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    users[role] = { id: data.user.id, email, name };
    passwords[role] = password;
  }

  runStep(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "--config",
      "tests/e2e/support/vitest.seed.config.ts",
    ],
    {
      ...serverEnv,
      E2E_USERS: JSON.stringify(users),
      E2E_MANIFEST: manifestPath,
    },
  );
  const manifest = {
    tag,
    ...JSON.parse(fs.readFileSync(manifestPath, "utf8")),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return passwords;
}

function parseAdmin(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username || "postgres"),
    password: decodeURIComponent(parsed.password || ""),
    database: "postgres",
  };
}

function stopAll() {
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

let exitCode = 1;
try {
  let passwords;
  if (reuse) {
    passwords = JSON.parse(fs.readFileSync(keptPath, "utf8")).passwords;
  } else {
    console.log("Preparing the database and test accounts…");
    passwords = await prepare();

    const sink = start("node", [
      "tests/e2e/support/smtp-sink.mjs",
      "2526",
      mailDir,
    ]);
    sink.stdout.on("data", () => {});

    console.log("Building the production app…");
    const buildLog = fs.openSync(path.join(outDir, "build.log"), "w");
    try {
      execFileSync("pnpm", ["build"], {
        cwd: root,
        env: serverEnv,
        stdio: ["ignore", buildLog, buildLog],
      });
    } catch (error) {
      console.error(
        fs.readFileSync(path.join(outDir, "build.log"), "utf8").slice(-4000),
      );
      throw error;
    }

    const serverLog = fs.openSync(path.join(outDir, "server.log"), "w");
    start("pnpm", ["exec", "next", "start", "-p", String(port)], {
      stdio: ["ignore", serverLog, serverLog],
    });
    await waitFor(`${baseUrl}/api/health`);
    if (keep) {
      fs.writeFileSync(
        keptPath,
        JSON.stringify({ passwords, pids: children.map((child) => child.pid) }),
      );
    }
  }

  console.log("Running Playwright…");
  const result = spawn(
    "pnpm",
    ["exec", "playwright", "test", ...playwrightArgs],
    {
      cwd: root,
      env: {
        ...process.env,
        E2E_BASE_URL: baseUrl,
        E2E_DATABASE_URL: databaseUrl,
        E2E_PASSWORDS: JSON.stringify(passwords),
        E2E_MANIFEST: manifestPath,
      },
      stdio: "inherit",
    },
  );
  exitCode = await new Promise((resolve) => result.on("exit", resolve));
} finally {
  // A kept setup stays up for --reuse runs; the next full run replaces it.
  if (!keep && !reuse) {
    stopAll();
    const removed = await deleteTestUsers().catch(() => 0);
    console.log(`Removed ${removed} test accounts.`);
  }
}
process.exit(exitCode ?? 1);
