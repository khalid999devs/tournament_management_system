"use server";

import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/features/auth/server/staff-session";
import { staffLoginSchema } from "@/features/auth/domain/staff-login";
import { allowAttempt, clientAddress, rateLimits } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const input = staffLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!input.success) {
    redirect("/staff/login?error=invalid_credentials");
  }

  // Checked here, before Supabase, so one person guessing passwords cannot
  // use up the sign-in allowance every staff member shares.
  const address = await clientAddress();
  const allowed =
    (await allowAttempt(
      "login-address",
      address,
      rateLimits.staffLoginAddress,
    )) &&
    (await allowAttempt(
      "login-account",
      `${address}|${input.data.email.toLowerCase()}`,
      rateLimits.staffLoginAccount,
    ));
  if (!allowed) redirect("/staff/login?error=too_many_attempts");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(input.data);

  if (error) {
    redirect("/staff/login?error=invalid_credentials");
  }

  const staff = await getCurrentStaff();

  if (!staff) {
    await supabase.auth.signOut();
    redirect("/staff/login?error=access_denied");
  }

  redirect(staff.role === "SUPER_ADMIN" ? "/admin" : "/operator");
}
