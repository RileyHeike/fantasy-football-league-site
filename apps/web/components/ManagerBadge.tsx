import Link from "next/link";
import type { ReactNode } from "react";
import { jersey } from "@/lib/palette";

/**
 * Purely presentational — takes already-resolved display data, no server
 * lookups. Safe to import from client components (e.g. modal content fed by
 * plain props), unlike ManagerName in ui.tsx which reads the snapshot.
 */
export function ManagerBadge({ name, colorIndex, sub, href }: { name: string; colorIndex: number; sub?: ReactNode; href?: string }) {
  const inner = (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ background: jersey(colorIndex) }} />
      <span>
        <span className="font-medium">{name}</span>
        {sub && <span className="block text-sm leading-tight text-chalk-dim">{sub}</span>}
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="hover:underline decoration-yardline underline-offset-4">
      {inner}
    </Link>
  ) : (
    inner
  );
}
