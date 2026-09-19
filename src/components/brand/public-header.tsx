"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/rulebook", label: "Rulebook" },
  { href: "/results", label: "Results" },
];

export function PublicHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <header className="site-header page-width">
      <Link className="brand" href="/" aria-label="NDCAK Indoor Games home">
        <Image
          className="brand-logo"
          src="/brand/ndcak-mark.webp"
          alt=""
          width={160}
          height={71}
          priority
        />
        <span className="brand-copy">
          <strong>NDCAK</strong>
          <small>Indoor Games Championship</small>
        </span>
      </Link>

      <nav
        id="site-navigation"
        className={menuOpen ? "site-nav open" : "site-nav"}
        aria-label="Main navigation"
      >
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
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="header-actions">
        {/* Already in the registration flow: the page has its own actions. */}
        {pathname.startsWith("/register") ? null : (
          <Link className="nav-cta" href="/register">
            Register{" "}
            <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        )}
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}
