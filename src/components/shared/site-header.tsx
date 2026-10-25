import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const NAV_LINKS = [
  { href: "/safety", label: "Safety" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="rounded-sm text-[15px] font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Parley
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <ul className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
