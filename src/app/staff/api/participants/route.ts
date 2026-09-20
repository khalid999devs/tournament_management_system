import { NextResponse, type NextRequest } from "next/server";
import { getCurrentStaff } from "@/features/auth/server/staff-session";
import { searchParticipantEntries } from "@/features/operators/server/operator-queries";

export const dynamic = "force-dynamic";

/**
 * Players for the assignment picker. An event can hold hundreds, so the
 * operator page never ships them; the picker asks for a page of matches only
 * once an admin opens it and starts typing.
 */
export async function GET(request: NextRequest) {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  const entries = await searchParticipantEntries(query);

  return NextResponse.json(
    { entries },
    { headers: { "cache-control": "no-store" } },
  );
}
