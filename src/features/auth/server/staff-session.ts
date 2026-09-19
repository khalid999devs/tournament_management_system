import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDatabase } from "@/db";
import { staffProfiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export type StaffIdentity = {
  id: string;
  authUserId: string;
  email: string | null;
  displayName: string;
  role: "SUPER_ADMIN" | "SCORE_OPERATOR";
};

export class StaffAuthorizationError extends Error {
  constructor() {
    super("UNAUTHORIZED_STAFF");
    this.name = "StaffAuthorizationError";
  }
}

export async function getCurrentStaff(): Promise<StaffIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims || typeof data.claims.sub !== "string") {
    return null;
  }

  const [profile] = await getDatabase()
    .select({
      id: staffProfiles.id,
      authUserId: staffProfiles.authUserId,
      displayName: staffProfiles.displayName,
      role: staffProfiles.role,
      active: staffProfiles.active,
    })
    .from(staffProfiles)
    .where(eq(staffProfiles.authUserId, data.claims.sub))
    .limit(1);

  if (!profile?.active) return null;

  return {
    id: profile.id,
    authUserId: profile.authUserId,
    displayName: profile.displayName,
    role: profile.role,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
}

export async function requireStaffPage() {
  const staff = await getCurrentStaff();

  if (!staff) redirect("/staff/login");
  return staff;
}

export async function requireSuperAdminPage() {
  const staff = await requireStaffPage();

  if (staff.role !== "SUPER_ADMIN") redirect("/operator");
  return staff;
}

export async function requireOperatorPage() {
  const staff = await requireStaffPage();

  if (staff.role !== "SCORE_OPERATOR") redirect("/admin");
  return staff;
}

export async function requireSuperAdmin() {
  const staff = await getCurrentStaff();

  if (!staff || staff.role !== "SUPER_ADMIN") {
    throw new StaffAuthorizationError();
  }

  return staff;
}
