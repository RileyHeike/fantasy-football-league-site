"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  comingSoon?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "This season",
    items: [
      { href: "/standings/", label: "Standings" },
      { href: "/power-rankings/", label: "Power rankings", comingSoon: true },
      { href: "/lineup-efficiency/", label: "Lineup efficiency", comingSoon: true },
    ],
  },
  {
    label: "League",
    items: [
      { href: "/history/", label: "History" },
      { href: "/managers/", label: "Managers" },
      { href: "/rivalries/", label: "Rivalries" },
      { href: "/manager-tendencies/", label: "Manager tendencies", comingSoon: true },
    ],
  },
  {
    label: "Moves",
    items: [
      { href: "/transactions/", label: "Transactions" },
      { href: "/draft/", label: "Draft" },
      { href: "/draft-grades/", label: "Draft grades", comingSoon: true },
      { href: "/trade-grades/", label: "Trade grades", comingSoon: true },
      { href: "/waiver-value/", label: "Waiver wire value", comingSoon: true },
    ],
  },
];

function ComingSoonTag() {
  return <span className="ml-2 rounded border border-yardline px-1.5 py-0.5 text-[11px] text-chalk-dim">Coming soon</span>;
}

export function SiteHeader({ leagueName }: { leagueName: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="border-b border-yardline">
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-5 py-4">
        <Link href="/" className="font-display text-2xl font-extrabold leading-none tracking-tight">
          {leagueName}
        </Link>
        <nav aria-label="Main" ref={ref} className="hidden flex-1 items-center gap-1 md:flex">
          {GROUPS.map((group) => (
            <div key={group.label} className="relative">
              <button
                type="button"
                onClick={() => setOpen(open === group.label ? null : group.label)}
                aria-expanded={open === group.label}
                className="rounded px-3 py-2 text-chalk-dim hover:text-chalk"
              >
                {group.label} <span aria-hidden className="text-xs">{open === group.label ? "▴" : "▾"}</span>
              </button>
              {open === group.label && (
                <div className="absolute left-0 top-full z-20 mt-1 min-w-56 rounded-lg border border-yardline bg-field-raised py-1.5 shadow-xl">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(null)}
                      className="flex items-center justify-between px-4 py-2 text-sm text-chalk hover:bg-field-sunk"
                    >
                      {item.label}
                      {item.comingSoon && <ComingSoonTag />}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href="/records/" className="rounded px-3 py-2 text-chalk-dim hover:text-chalk">
            Records
          </Link>
        </nav>
        <div className="ml-auto md:ml-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/** Phones get a bottom tab bar: most visits are thumbs on a Sunday. Pinned destinations plus a "More" sheet for the rest. */
export function MobileTabBar() {
  const [open, setOpen] = useState(false);
  const PINNED: NavItem[] = [
    { href: "/", label: "Home" },
    { href: "/standings/", label: "Standings" },
    { href: "/records/", label: "Records" },
  ];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60 md:hidden" onClick={() => setOpen(false)}>
          <div
            className="max-h-[75vh] w-full overflow-y-auto rounded-t-xl border-t border-yardline bg-field-raised p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Menu</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="px-1.5 py-1 text-chalk-dim hover:text-chalk">
                ✕
              </button>
            </div>
            {GROUPS.map((group) => (
              <div key={group.label} className="mb-5">
                <p className="mb-2 text-sm text-chalk-dim">{group.label}</p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between rounded px-2 py-2 hover:bg-field-sunk"
                      >
                        {item.label}
                        {item.comingSoon && <ComingSoonTag />}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-yardline bg-field/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-4 text-center text-xs">
          {PINNED.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="block py-3 text-chalk-dim hover:text-chalk">
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setOpen(true)} className="block w-full py-3 text-chalk-dim hover:text-chalk">
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
