import { getCurrentStaff } from "@/features/auth/server/staff-session";
import {
  buildExport,
  isExportKind,
  recordExport,
} from "@/features/analytics/server/exports";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// CSV downloads for admins. Each download is recorded in the audit log,
// because the files contain participant contact details.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== "SUPER_ADMIN") {
    return new Response("Sign in as an admin to download reports.", {
      status: 403,
    });
  }

  const { kind } = await params;
  if (!isExportKind(kind)) {
    return new Response("Unknown report.", { status: 404 });
  }

  const query = Object.fromEntries(new URL(request.url).searchParams);
  const result = await buildExport(kind, query);
  await recordExport(staff.id, kind, result);

  return new Response(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
