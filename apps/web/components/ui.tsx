import type { ReactNode } from "react";
import { formatRecord } from "@league/core";
import { ManagerBadge } from "./ManagerBadge";
import { manager } from "@/lib/data";

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-6xl">{children}</h1>
      {sub && <p className="mt-3 max-w-prose text-chalk-dim">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="font-display text-3xl font-bold tracking-tight">{children}</h2>
      {aside && <div className="text-sm text-chalk-dim">{aside}</div>}
    </div>
  );
}

/** A manager's name with their jersey color. Links to their profile. */
export function ManagerName({ id, sub, plain }: { id: string; sub?: ReactNode; plain?: boolean }) {
  const m = manager(id);
  return <ManagerBadge name={m.name} colorIndex={m.colorIndex} sub={sub} href={plain ? undefined : `/managers/${m.id}/`} />;
}

export function Rec({ w, l, t = 0 }: { w: number; l: number; t?: number }) {
  return <span className="num">{formatRecord(w, l, t)}</span>;
}

export function Table({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-yardline">
      <table className="w-full border-collapse text-left text-[15px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export const th = "px-3 py-2 font-medium text-chalk-dim text-sm border-b border-yardline whitespace-nowrap";
export const td = "px-3 py-2 border-b border-yardline/60 whitespace-nowrap";
export const tdNum = `${td} num text-right`;
export const thNum = `${th} text-right`;

/** Trophy marker. Gold is reserved for this and record holders. */
export function Trophy({ label = "Champion" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded bg-gold px-1.5 py-0.5 text-xs font-semibold text-gold-ink" title={label}>
      {label}
    </span>
  );
}

export function ResultPill({ r }: { r: "W" | "L" | "T" }) {
  const cls = r === "W" ? "text-win" : r === "L" ? "text-loss" : "text-chalk-dim";
  return <span className={`num font-semibold ${cls}`}>{r}</span>;
}

/** Shell for a nav entry that's wired in but not built yet. */
export function ComingSoonPage({ title, blurb, note }: { title: string; blurb: string; note?: string }) {
  return (
    <>
      <PageTitle sub={blurb}>{title}</PageTitle>
      <div className="inline-flex items-center gap-2 rounded-lg border border-yardline px-4 py-2.5 text-sm text-chalk-dim">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-chalk-dim" />
        {note ?? "Not built yet. It'll show up here once it's ready."}
      </div>
    </>
  );
}
