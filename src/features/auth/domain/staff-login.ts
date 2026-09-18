import { z } from "zod";

export const staffLoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});
