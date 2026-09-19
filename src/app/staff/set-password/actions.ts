"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentStaff } from "@/features/auth/server/staff-session";
import { createClient } from "@/lib/supabase/server";

const passwordSchema = z
  .object({
    password: z.string().min(12).max(128),
    confirmation: z.string(),
  })
  .refine(({ password, confirmation }) => password === confirmation);

export async function setStaffPassword(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/staff/login?error=invalid_link");

  const input = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });

  if (!input.success) redirect("/staff/set-password?error=invalid_password");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: input.data.password,
  });

  if (error) redirect("/staff/set-password?error=update_failed");

  redirect(staff.role === "SUPER_ADMIN" ? "/admin" : "/operator");
}
