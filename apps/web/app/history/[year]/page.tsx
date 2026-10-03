import { notFound } from "next/navigation";
import { BracketView } from "@/components/BracketView";
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

export default async function SeasonPage({ params }: { params: Promise<{ year: string }> }) {
  const year = Number((await params).year);
  const s = season(year);
  if (!s) notFound();
  const games = gamesFor(year);
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

      {s.winnersBracket.length > 0 && (
        <section className="mb-14">
          <SectionTitle>Playoff bracket</SectionTitle>
          <BracketView bracket={s.winnersBracket} year={year} />
        </section>
      )}

      {s.losersBracket.length > 0 && (
        <section className="mb-14">
          <SectionTitle aside="Loser plays on">Consolation bracket</SectionTitle>
          <BracketView bracket={s.losersBracket} year={year} />
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
