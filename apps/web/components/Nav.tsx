import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/standings/", label: "Standings" },
  { href: "/records/", label: "Records" },
  { href: "/managers/", label: "Managers" },
  { href: "/rivalries/", label: "Rivalries" },
  { href: "/history/", label: "History" },
];

export function SiteHeader({ leagueName }: { leagueName: string }) {
  return (
    <header className="border-b border-yardline">
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-5 py-4">
        <Link href="/" className="font-display text-2xl font-extrabold leading-none tracking-tight">
          {leagueName}
        </Link>
        <nav aria-label="Main" className="hidden flex-1 gap-6 md:flex">
          {LINKS.slice(1).map((l) => (
            <Link key={l.href} href={l.href} className="text-chalk-dim hover:text-chalk">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto md:ml-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/** Phones get a bottom tab bar: most visits are thumbs on a Sunday. */
export function MobileTabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-yardline bg-field/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-6 text-center text-xs">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block py-3 text-chalk-dim hover:text-chalk">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
