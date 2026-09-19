import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPER_ADMIN_EMAIL: z.email().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_REPLY_TO: z.email().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
});

const supabaseEnvSchema = serverEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: true,
});

const resendEmailSchema = z.object({
  RESEND_API_KEY: z.string().startsWith("re_").min(20),
  EMAIL_FROM: z.string().min(3),
  EMAIL_REPLY_TO: z.email(),
});

// Gmail (or any SMTP host) sends as the signed-in account, so the sender is
// always SMTP_USER; only the display name is configurable.
const smtpEmailSchema = z.object({
  SMTP_HOST: z.string().min(1).default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.email(),
  SMTP_PASSWORD: z
    .string()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(z.string().min(8)),
  EMAIL_FROM_NAME: z.string().min(1).default("NDCAK Indoor Games"),
  EMAIL_REPLY_TO: z.email(),
});

export type EmailEnv =
  | ({ transport: "smtp" } & z.infer<typeof smtpEmailSchema>)
  | ({ transport: "resend" } & z.infer<typeof resendEmailSchema>);

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

export function getEmailEnv(): EmailEnv {
  const useSmtp = Boolean(process.env.SMTP_USER || process.env.SMTP_PASSWORD);
  const result = useSmtp
    ? smtpEmailSchema.safeParse(process.env)
    : resendEmailSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      `Invalid email environment: ${z.prettifyError(result.error)}`,
    );
  }

  return {
    transport: useSmtp ? "smtp" : "resend",
    ...result.data,
  } as EmailEnv;
}

// Links in emails and metadata must point at the deployed site. On Vercel the
// free *.vercel.app address is used automatically unless NEXT_PUBLIC_APP_URL
// overrides it (for example after a custom domain is added).
export function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  const vercelHost =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;

  return vercelHost ? `https://${vercelHost}` : "http://localhost:3000";
}
