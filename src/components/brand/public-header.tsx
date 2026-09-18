"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/register", label: "Register" },
  { href: "/schedule", label: "Schedule" },
  { href: "/rulebook", label: "Rulebook" },
  { href: "/results", label: "Results" },
  { href: "/staff/login", label: "Staff" },
];

export function PublicHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header page-width">
      <Link className="brand" href="/" aria-label="NDCAK tournament home">
        <Image
          className="brand-logo"
          src="/brand/ndcak-mark.png"
          alt="Notre Dame College Association of KUET"
          width={1536}
          height={800}
          priority
        />
        <span className="brand-copy">
          <strong>NDCAK</strong>
          <small>Indoor Games Championship</small>
        </span>
      </Link>

      <nav className="desktop-nav" aria-label="Main navigation">
        {navigation.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              className={active ? "active" : undefined}
              href={item.href}
              aria-current={active ? "page" : undefined}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link className="nav-cta" href="/register">
        Register <span aria-hidden="true">→</span>
      </Link>
    </header>
  );
}
