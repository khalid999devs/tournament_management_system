"use client";

import {
  Bell,
  CalendarCog,
  Gamepad2,
  LayoutDashboard,
  Swords,
  UserCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/event", label: "Event", icon: CalendarCog },
  { href: "/admin/games", label: "Games", icon: Gamepad2 },
  { href: "/admin/matches", label: "Matches", icon: Swords },
  { href: "/admin/registrations", label: "Registrations", icon: UserCheck },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/operators", label: "Operators", icon: UsersRound },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/admin" ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={17} aria-hidden="true" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
