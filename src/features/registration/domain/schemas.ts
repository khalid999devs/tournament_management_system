import { z } from "zod";
import { normalizeBangladeshPhone, normalizeStudentId } from "./normalization";

const bangladeshPhonePattern = /^\+8801[3-9]\d{8}$/;

export function createRegistrationDetailsSchema(maxGames: number) {
  return z.object({
    fullName: z.string().trim().min(2).max(160),
    studentId: z
      .string()
      .transform(normalizeStudentId)
      .pipe(z.string().min(3).max(64)),
    email: z.email().max(254),
    phone: z
      .string()
      .transform(normalizeBangladeshPhone)
      .pipe(
        z
          .string()
          .regex(
            bangladeshPhonePattern,
            "Enter a valid Bangladesh mobile number.",
          ),
      ),
    department: z.string().trim().min(1).max(120),
    academicYear: z.string().trim().min(1).max(40),
    selectedGameIds: z
      .array(z.string().min(1))
      .min(1, "Select at least one game.")
      .max(maxGames, `Select no more than ${maxGames} games.`)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Each game can be selected only once.",
      }),
  });
}

export type RegistrationDetails = z.infer<
  ReturnType<typeof createRegistrationDetailsSchema>
>;
