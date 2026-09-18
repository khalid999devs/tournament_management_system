import Image from "next/image";
import Link from "next/link";

export function PublicHeader() {
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
        <Link href="/schedule">Schedule</Link>
        <Link href="/rulebook">Rulebook</Link>
        <Link href="/results">Results</Link>
      </nav>

      <Link className="nav-cta" href="/register">
        Register
      </Link>
    </header>
  );
}
