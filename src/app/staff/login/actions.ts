"use server";

import { redirect } from "next/navigation";
import { staffLoginSchema } from "@/features/auth/domain/staff-login";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const input = staffLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!input.success) {
    redirect("/staff/login?error=invalid_credentials");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(input.data);

  if (error) {
    redirect("/staff/login?error=invalid_credentials");
  }

  redirect("/staff");
}
