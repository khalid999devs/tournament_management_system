import postgres from "postgres";

const databaseUrl =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
const email = process.env.SUPER_ADMIN_EMAIL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or MIGRATION_DATABASE_URL is required.");
}

if (!email) {
  throw new Error("SUPER_ADMIN_EMAIL is required.");
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: "require",
});

try {
  const [authUser] = await sql`
    select id
    from auth.users
    where lower(email) = lower(${email})
    limit 1
  `;

  if (!authUser) {
    throw new Error(
      "Create the SUPER_ADMIN_EMAIL user in Supabase Authentication first.",
    );
  }

  await sql`
    insert into public.staff_profiles (
      auth_user_id,
      role,
      display_name,
      active
    ) values (
      ${authUser.id},
      'SUPER_ADMIN',
      'NDCAK Super Admin',
      true
    )
    on conflict (auth_user_id) do update
    set
      role = excluded.role,
      display_name = excluded.display_name,
      active = true,
      updated_at = now()
  `;

  console.log("Super Admin staff profile is ready.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Bootstrap failed.");
  process.exitCode = 1;
} finally {
  await sql.end();
}
