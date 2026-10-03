import Link from "next/link";
import { formatPoints } from "@league/core";
import { RingOfHonor } from "@/components/RingOfHonor";
import { Scoreboard } from "@/components/Scoreboard";
import { ManagerName, Rec, SectionTitle, Table, td, tdNum, th, thNum } from "@/components/ui";
import { buildMatchup, currentSeason, gamesFor, snapshot, stats } from "@/lib/data";
import { StandingsTable } from "@/components/StandingsTable";

const HEADLINE_RECORDS = ["high-score", "biggest-blowout", "win-streak"];

export default function Home() {
  const snap = snapshot();
  const cur = currentSeason();
  const week = Math.min(snap.nfl.week, cur.lastWeek);
  let games = gamesFor(cur.year, week);
  let weekLabel = `Week ${week}, ${cur.year}`;
  if (!games.length) {
    const lastWeek = Math.max(0, ...gamesFor(cur.year).map((g) => g.week));
    games = gamesFor(cur.year, lastWeek);
    weekLabel = `Week ${lastWeek}, ${cur.year}`;
  }
  const standings = stats().standings.bySeason[cur.year] ?? [];
  const records = stats().records.filter((r) => HEADLINE_RECORDS.includes(r.id));
  const trophyName = "Champion";

  return (
    <>
      <RingOfHonor cases={stats().trophies} trophyName={trophyName} />

      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionTitle aside={weekLabel}>This week</SectionTitle>
          {games.length ? <Scoreboard matchups={games.map((g) => buildMatchup(g))} /> : <p className="text-chalk-dim">No games yet this season. The first scores show up after week 1.</p>}
        </section>

        <section>
          <SectionTitle aside={<Link href="/standings/" className="hover:text-chalk">Full standings</Link>}>
            {cur.year} standings
          </SectionTitle>
          <StandingsTable lines={standings} year={cur.year} compact />
        </section>
      </div>

      <section className="mt-14">
        <SectionTitle aside={<Link href="/records/" className="hover:text-chalk">All records</Link>}>Record book</SectionTitle>
        <ul className="grid gap-4 md:grid-cols-3">
          {records.map((r) => (
            <li key={r.id} className="rounded-lg border border-yardline p-5">
              <p className="text-chalk-dim">{r.label}</p>
              <p className="num mt-1 font-display text-5xl font-extrabold text-gold">
                {r.unit === "pts" ? formatPoints(r.value) : r.value}
                <span className="ml-2 text-xl font-bold text-chalk-dim">{r.unit === "pts" ? "pts" : r.unit}</span>
              </p>
              <div className="mt-3"><ManagerName id={r.managerId} sub={r.week ? `Week ${r.week}, ${r.season}` : `Starting ${r.season}`} /></div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
