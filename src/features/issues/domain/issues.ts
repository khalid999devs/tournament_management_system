import { z } from "zod";

export const issueCategories = {
  NO_SHOW: "A player did not show up",
  SCORE_DISPUTE: "Score or result dispute",
  EQUIPMENT: "Equipment or table problem",
  CONDUCT: "Player conduct",
  SCHEDULE: "Timing or schedule",
  OTHER: "Something else",
} as const;

export type IssueCategory = keyof typeof issueCategories;

const categoryKeys = Object.keys(issueCategories) as [
  IssueCategory,
  ...IssueCategory[],
];

export const issueReportSchema = z.object({
  matchId: z.uuid().nullable(),
  category: z.enum(categoryKeys, { error: "Choose what kind of problem." }),
  message: z
    .string()
    .trim()
    .min(5, "Describe the problem in a few words.")
    .max(1000, "Keep the description under 1,000 characters."),
  clientRequestId: z.uuid(),
});

export type IssueReportInput = z.infer<typeof issueReportSchema>;

export const issueResolveSchema = z.object({
  issueId: z.uuid(),
  note: z.string().trim().max(1000).optional(),
});

export function describeIssueCategory(category: string) {
  return issueCategories[category as IssueCategory] ?? "Problem";
}
