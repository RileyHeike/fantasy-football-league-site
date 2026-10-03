import { notFound } from "next/navigation";
import { formatPoints, ordinal } from "@league/core";
import { FinishChart } from "@/components/FinishChart";
import { ManagerName, PageTitle, Rec, SectionTitle, Table, td, tdNum, th, thNum, Trophy } from "@/components/ui";
import { league, stats, teamName } from "@/lib/data";
import { jersey } from "@/lib/palette";

export function generateStaticParams() {
  return league().managers.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  return { title: league().managers.find((x) => x.id === id)?.name ?? "Manager" };
}

export default async function ManagerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = league().managers.find((x) => x.id === id);
  if (!m) notFound();
  const s = stats();
  const c = s.standings.career.find((x) => x.managerId === id)!;
  const color = jersey(m.colorIndex);

  const seasonRows = league().seasons
    .filter((se) => se.teams.some((t) => t.managerId === id))
    .map((se) => {
      const line = s.standings.bySeason[se.year]!.find((l) => l.managerId === id)!;
      const adv = s.advanced.find((a) => a.season === se.year && a.managerId === id);
      return { se, line, adv };
    })
    .reverse();

  const done = seasonRows.filter((r) => r.se.status === "complete");
  const avgPf = done.reduce((n, r) => n + r.line.pointsFor, 0) / Math.max(1, done.length);
  const rivals = Object.values(s.headToHead[id] ?? {}).sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
  const recordsHeld = s.records.filter((r) => r.managerId === id);

  return (
    <>
      <div className="mb-10 border-l-8 pl-5" style={{ borderColor: color }}>
        <PageTitle sub={m.teamNames.length > 1 ? `Also played as ${m.teamNames.slice(0, -1).join(", ")}` : undefined}>
          {m.name}
        </PageTitle>
        <p className="-mt-5 text-xl">{m.teamNames.at(-1)}</p>
      </div>

      <dl className="mb-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {[
          ["Titles", <span key="t" className={c.championships ? "text-gold" : ""}>{c.championships}</span>],
          ["Regular season", <Rec key="r" w={c.wins} l={c.losses} t={c.ties} />],
          ["Playoffs", <Rec key="p" w={c.playoffWins} l={c.playoffLosses} />],
          ["Points per season", formatPoints(avgPf)],
        ].map(([label, value]) => (
          <div key={label as string}>
            <dt className="text-chalk-dim">{label}</dt>
            <dd className="num font-display text-4xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mb-14">
        <SectionTitle aside="Gold rings mark championships">Regular-season rank</SectionTitle>
        <FinishChart
          color={color}
          teams={league().seasons.at(-1)?.teams.length ?? 12}
          points={[...seasonRows].reverse().filter((r) => r.se.status === "complete").map((r) => ({ year: r.se.year, rank: r.line.rank, champion: r.line.finish === "champion" }))}
        />
      </section>

      <section className="mb-14">
        <SectionTitle>Season by season</SectionTitle>
        <Table caption="Seasons">
          <thead>
            <tr>
              <th className={th}>Season</th><th className={th}>Team</th><th className={thNum}>Record</th><th className={thNum}>Rank</th>
              <th className={thNum}>PF</th><th className={thNum}>All-play</th><th className={thNum}>Luck</th><th className={th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {seasonRows.map(({ se, line, adv }) => (
              <tr key={se.year}>
                <td className={`${td} font-display text-xl font-bold`}>{se.year}</td>
                <td className={td}>{teamName(id, se.year)}</td>
                <td className={tdNum}><Rec w={line.wins} l={line.losses} t={line.ties} /></td>
                <td className={tdNum}>{ordinal(line.rank)}</td>
                <td className={tdNum}>{formatPoints(line.pointsFor)}</td>
                <td className={tdNum}>{adv ? `${(adv.allPlayPct * 100).toFixed(0)}%` : ""}</td>
                <td className={`${tdNum} ${adv && adv.luck > 0.5 ? "text-win" : adv && adv.luck < -0.5 ? "text-loss" : ""}`}>
                  {adv ? `${adv.luck > 0 ? "+" : ""}${adv.luck.toFixed(1)}` : ""}
                </td>
                <td className={td}>
                  {line.finish === "champion" ? <Trophy /> : se.status !== "complete" ? <span className="text-chalk-dim">In progress</span>
                    : line.finish === "runnerUp" ? "Runner-up" : line.finish === "last" ? <span className="text-loss">Last place</span>
                    : line.madePlayoffs ? "Playoffs" : <span className="text-chalk-dim">Missed playoffs</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-3 text-sm text-chalk-dim">All-play: how often this team outscored every other team each week. Luck: actual wins minus the wins all-play would predict.</p>
      </section>

      <section className="mb-14">
        <SectionTitle>Head-to-head</SectionTitle>
        <Table caption="Head-to-head">
          <thead>
            <tr><th className={th}>Opponent</th><th className={thNum}>Record</th><th className={thNum}>Avg margin</th><th className={thNum}>Playoff meetings</th><th className={thNum}>Streak</th></tr>
          </thead>
          <tbody>
            {rivals.map((r) => {
              const games = r.wins + r.losses + r.ties;
              const margin = (r.pointsFor - r.pointsAgainst) / Math.max(1, games);
              return (
                <tr key={r.opponentId}>
                  <td className={td}><ManagerName id={r.opponentId} /></td>
                  <td className={tdNum}><Rec w={r.wins} l={r.losses} t={r.ties} /></td>
                  <td className={`${tdNum} ${margin > 0 ? "text-win" : margin < 0 ? "text-loss" : ""}`}>{margin > 0 ? "+" : ""}{margin.toFixed(1)}</td>
                  <td className={tdNum}>{r.playoffMeetings}</td>
                  <td className={tdNum}>{r.streak}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </section>

      {recordsHeld.length > 0 && (
        <section>
          <SectionTitle>League records held</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {recordsHeld.map((r) => (
              <li key={r.id} className="rounded-full border border-gold px-3 py-1 text-gold">{r.label}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
