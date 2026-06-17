import Link from "next/link";

const links = [
  { href: "/", label: "Oversikt" },
  { href: "/kapasitet", label: "Kart og kapasitet" },
  { href: "/scenarier", label: "Scenarier" },
  { href: "/kilder", label: "Kilder" }
];

export function TopNav() {
  return (
    <nav className="nav" aria-label="Hovednavigasjon">
      {links.map((link) => (
        <Link key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
