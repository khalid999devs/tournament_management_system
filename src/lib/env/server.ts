import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPER_ADMIN_EMAIL: z.email().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_REPLY_TO: z.email().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
});

const supabaseEnvSchema = serverEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: true,
});

const emailEnvSchema = z.object({
  RESEND_API_KEY: z.string().startsWith("re_").min(20),
  EMAIL_FROM: z.string().min(3),
  EMAIL_REPLY_TO: z.email(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      `Invalid server environment: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

export function getSupabaseEnv() {
  const result = supabaseEnvSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      `Invalid Supabase environment: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

export function getEmailEnv() {
  const result = emailEnvSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      `Invalid email environment: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
