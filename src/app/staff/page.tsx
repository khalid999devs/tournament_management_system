import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStaffPage } from "@/features/auth/server/staff-session";

export const metadata: Metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};

export default async function StaffPage() {
  const staff = await requireStaffPage();
  redirect(staff.role === "SUPER_ADMIN" ? "/admin" : "/operator");
}
