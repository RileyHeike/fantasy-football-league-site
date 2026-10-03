import { formatPoints } from "@league/core";
import { StandingsTable } from "@/components/StandingsTable";
import { ManagerName, PageTitle, Rec, SectionTitle, Table, td, tdNum, th, thNum } from "@/components/ui";
import { currentSeason, stats } from "@/lib/data";

export const metadata = { title: "Standings" };

export default function Standings() {
  const cur = currentSeason();
  const career = stats().standings.career;
  return (
    <>
      <PageTitle sub="Regular-season records. Ties in record are broken by points scored.">Standings</PageTitle>
      <section className="mb-14">
        <SectionTitle>{cur.year} season</SectionTitle>
        <StandingsTable lines={stats().standings.bySeason[cur.year] ?? []} year={cur.year} />
      </section>
      <section>
        <SectionTitle aside="Sorted by titles, then win rate">All-time</SectionTitle>
        <Table caption="All-time standings">
          <thead>
            <tr>
              <th className={th}>Manager</th>
              <th className={thNum}>Seasons</th>
              <th className={thNum}>Titles</th>
              <th className={thNum}>Record</th>
              <th className={thNum}>Win %</th>
              <th className={thNum}>Playoffs</th>
              <th className={thNum}>Playoff record</th>
              <th className={thNum}>PF</th>
              <th className={thNum}>Last places</th>
            </tr>
          </thead>
          <tbody>
            {career.map((c) => (
              <tr key={c.managerId} className="hover:bg-field-sunk">
                <td className={td}><ManagerName id={c.managerId} /></td>
                <td className={tdNum}>{c.seasons}</td>
                <td className={`${tdNum} ${c.championships ? "font-semibold text-gold" : "text-chalk-dim"}`}>{c.championships}</td>
                <td className={tdNum}><Rec w={c.wins} l={c.losses} t={c.ties} /></td>
                <td className={tdNum}>{(c.winPct * 100).toFixed(1)}</td>
                <td className={tdNum}>{c.playoffAppearances}</td>
                <td className={tdNum}><Rec w={c.playoffWins} l={c.playoffLosses} /></td>
                <td className={tdNum}>{formatPoints(c.pointsFor)}</td>
                <td className={`${tdNum} ${c.lastPlaces ? "text-loss" : "text-chalk-dim"}`}>{c.lastPlaces}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </>
  );
}
