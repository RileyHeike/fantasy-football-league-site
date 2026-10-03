import { notFound } from "next/navigation";
import { formatPoints, type Game } from "@league/core";
import { StandingsTable } from "@/components/StandingsTable";
import { ManagerName, PageTitle, SectionTitle, Table, td, tdNum, th, thNum } from "@/components/ui";
import { gamesFor, league, season, stats } from "@/lib/data";
import { jersey } from "@/lib/palette";
import { manager } from "@/lib/data";

export function generateStaticParams() {
  return league().seasons.map((s) => ({ year: String(s.year) }));
}

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  return { title: `${(await params).year} season` };
}

const ROUND_NAME: Record<number, string> = { 1: "Championship", 3: "Third place", 5: "Fifth place" };

export default async function SeasonPage({ params }: { params: Promise<{ year: string }> }) {
  const year = Number((await params).year);
  const s = season(year);
  if (!s) notFound();
  const games = gamesFor(year);
  const playoffs = games.filter((g) => g.kind === "playoff").sort((a, b) => b.week - a.week || (a.placement ?? 9) - (b.placement ?? 9));
  const regular = games.filter((g) => g.kind === "regular" && g.final);
  const weeks = [...new Set(regular.map((g) => g.week))].sort((a, b) => a - b);
  const standings = stats().standings.bySeason[year] ?? [];

  // Weekly score grid: rows = managers in standings order, cols = weeks.
  const scoreOf = new Map<string, number>();
  for (const g of regular) for (const side of [g.home, g.away]) scoreOf.set(`${side.managerId}:${g.week}`, side.points);
  const all = [...scoreOf.values()];
  const lo = Math.min(...all), hi = Math.max(...all);

  return (
    <>
      <PageTitle sub={s.status === "complete" ? undefined : "Season in progress. Standings update nightly."}>{year} season</PageTitle>

      <section className="mb-14">
        <SectionTitle>Final standings</SectionTitle>
        <StandingsTable lines={standings} year={year} />
      </section>

      {playoffs.length > 0 && (
        <section className="mb-14">
          <SectionTitle>Playoffs</SectionTitle>
          <ul className="grid gap-3 md:grid-cols-2">
            {playoffs.map((g) => <PlayoffGame key={g.id} g={g} />)}
          </ul>
        </section>
      )}

      {weeks.length > 0 && (
        <section>
          <SectionTitle aside="Darker cells are bigger scores">Week by week</SectionTitle>
          <Table caption="Weekly scores">
            <thead>
              <tr>
                <th className={th}>Manager</th>
                {weeks.map((w) => <th key={w} className={thNum}>{w}</th>)}
              </tr>
            </thead>
            <tbody>
              {standings.map((l) => {
                const color = jersey(manager(l.managerId).colorIndex);
                return (
                  <tr key={l.managerId}>
                    <td className={td}><ManagerName id={l.managerId} /></td>
                    {weeks.map((w) => {
                      const v = scoreOf.get(`${l.managerId}:${w}`);
                      const t = v === undefined ? 0 : (v - lo) / (hi - lo || 1);
                      return (
                        <td key={w} className={`${tdNum} text-sm`} style={{ background: v === undefined ? undefined : `color-mix(in srgb, ${color} ${Math.round(8 + t * 55)}%, transparent)` }}>
                          {v === undefined ? "" : v.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      )}
    </>
  );
}

function PlayoffGame({ g }: { g: Game }) {
  const label = g.placement ? ROUND_NAME[g.placement] ?? `Week ${g.week}` : `Week ${g.week}`;
  const isFinal = g.placement === 1;
  return (
    <li className={`rounded-lg border px-4 py-3 ${isFinal ? "border-gold" : "border-yardline"}`}>
      <p className={`mb-1 text-sm ${isFinal ? "text-gold" : "text-chalk-dim"}`}>{label}</p>
      {[g.home, g.away].map((side) => (
        <div key={side.managerId} className="flex items-center justify-between py-1">
          <ManagerName id={side.managerId} />
          <span className={`num font-display text-2xl font-bold ${g.winnerId === side.managerId ? "" : "text-chalk-dim"}`}>
            {formatPoints(side.points)}
          </span>
        </div>
      ))}
    </li>
  );
}
