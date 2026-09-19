import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/register", label: "Register" },
  { href: "/schedule", label: "Schedule" },
  { href: "/rulebook", label: "Rulebook" },
  { href: "/results", label: "Results" },
];

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="page-width footer-grid">
        <div className="footer-identity">
          <Image
            className="footer-brand"
            src="/brand/ndcak-lockup.webp"
            alt="Notre Dame College Association of KUET"
            width={560}
            height={241}
          />
          <p>
            The NDCAK Indoor Games Championship is organised by the Notre Dame
            College Association of KUET.
          </p>
        </div>
        <div className="footer-contact">
          <p>Official contact</p>
          <a href="mailto:ndcakofficial@gmail.com">ndcakofficial@gmail.com</a>
          <span>KUET Campus · Khulna, Bangladesh</span>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <p>Quick links</p>
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="page-width footer-bottom">
        <span>
          © {new Date().getFullYear()} Notre Dame College Association of KUET
        </span>
        <Link href="/staff/login">Authorized staff access</Link>
      </div>
    </footer>
  );
}
