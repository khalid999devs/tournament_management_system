import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { signOut } from "@/app/staff/actions";
import { requireSuperAdminPage } from "@/features/auth/server/staff-session";
import styles from "@/features/admin/components/admin.module.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | NDCAK Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const staff = await requireSuperAdminPage();

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <Link className={styles.adminBrand} href="/admin">
          <Image
            src="/brand/ndcak-mark.png"
            alt="NDCAK"
            width={640}
            height={640}
            priority
          />
          <span>
            <strong>NDCAK</strong>
            Tournament admin
          </span>
        </Link>
        <nav aria-label="Admin navigation">
          <Link href="/admin">
            <LayoutDashboard size={17} aria-hidden="true" /> Dashboard
          </Link>
          <Link href="/admin/registrations">
            <UserCheck size={17} aria-hidden="true" /> Registrations
          </Link>
          <Link href="/admin/notifications">
            <Bell size={17} aria-hidden="true" /> Notifications
          </Link>
          <Link href="/admin/operators">
            <UsersRound size={17} aria-hidden="true" /> Operators
          </Link>
        </nav>
        <div className={styles.adminIdentity}>
          <span>Signed in as</span>
          <strong>{staff.displayName}</strong>
          <small>{staff.email}</small>
          <form action={signOut}>
            <button type="submit">
              <LogOut size={15} aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className={styles.adminMain}>{children}</div>
    </div>
  );
}
