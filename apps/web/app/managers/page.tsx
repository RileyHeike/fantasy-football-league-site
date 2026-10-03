import Link from "next/link";
import { PageTitle, Rec } from "@/components/ui";
import { league, stats } from "@/lib/data";
import { jersey } from "@/lib/palette";

export const metadata = { title: "Managers" };

export default function Managers() {
  const career = new Map(stats().standings.career.map((c) => [c.managerId, c]));
  const managers = [...league().managers].sort(
    (a, b) => (career.get(b.id)?.championships ?? 0) - (career.get(a.id)?.championships ?? 0) || (career.get(b.id)?.winPct ?? 0) - (career.get(a.id)?.winPct ?? 0),
  );
  return (
    <>
      <PageTitle sub="Everyone who has held a roster in the league, past and present.">Managers</PageTitle>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {managers.map((m) => {
          const c = career.get(m.id)!;
          const active = m.lastSeason === Math.max(...league().seasons.map((s) => s.year));
          return (
            <li key={m.id}>
              <Link href={`/managers/${m.id}/`} className="block rounded-lg border border-yardline p-5 hover:bg-field-raised" style={{ borderLeft: `6px solid ${jersey(m.colorIndex)}` }}>
                <p className="font-display text-4xl font-extrabold leading-none">{m.name}</p>
                <p className="mt-1 truncate text-chalk-dim">{m.teamNames.at(-1)}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-chalk-dim">Record</dt><dd className="font-semibold"><Rec w={c.wins} l={c.losses} t={c.ties} /></dd></div>
                  <div><dt className="text-chalk-dim">Titles</dt><dd className={`num font-semibold ${c.championships ? "text-gold" : ""}`}>{c.championships}</dd></div>
                  <div><dt className="text-chalk-dim">Seasons</dt><dd className="num font-semibold">{active ? `${m.firstSeason} on` : `${m.firstSeason}–${m.lastSeason}`}</dd></div>
                </dl>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
