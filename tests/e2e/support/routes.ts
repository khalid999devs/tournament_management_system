import { db, run } from "./fixtures";

export const publicRoutes = [
  "/",
  "/register",
  "/schedule",
  "/rulebook",
  "/results",
  "/developers",
  "/staff/login",
  "/no-such-page",
];

// Detail pages use ids from the seeded run.
export async function adminRoutes() {
  const [pending] = await db()`
    select id from registrations where status = 'PENDING_REVIEW' order by created_at limit 1`;
  const [confirmed] = await db()`
    select id from registrations where status = 'CONFIRMED' order by created_at limit 1`;
  const [operator] = await db()`
    select id from staff_profiles where role = 'SCORE_OPERATOR' order by created_at limit 1`;
  return [
    "/admin",
    "/admin/registrations",
    `/admin/registrations/${pending.id}`,
    `/admin/registrations/${confirmed.id}`,
    "/admin/games",
    `/admin/games/${run.games["Table Tennis"]}`,
    "/admin/event",
    "/admin/matches",
    `/admin/matches/${run.tableTennisMatches.semiFinals[1]}`,
    `/admin/matches/${run.cardsMatches[0]}`,
    "/admin/operators",
    `/admin/operators/${operator.id}`,
    "/admin/notifications",
    "/admin/issues",
    "/admin/reports",
  ];
}

export function operatorRoutes() {
  return [
    "/operator",
    `/operator/matches/${run.tableTennisMatches.semiFinals[1]}`,
    `/operator/matches/${run.footballMatches[0]}`,
    `/operator/matches/${run.cardsMatches[0]}`,
  ];
}
