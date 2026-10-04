import { notFound } from "next/navigation";
import { DraftBoardCell } from "@/components/DraftBoardCell";
import { ManagerName, PageTitle, Table, td, th } from "@/components/ui";
import { buildDraftBoardView, draftPicksFor, league, playerName, playerPosition, season } from "@/lib/data";

export function generateStaticParams() {
  return league()
    .seasons.filter((s) => draftPicksFor(s.year).length > 0)
    .map((s) => ({ year: String(s.year) }));
}

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  return { title: `${(await params).year} draft` };
}

export default async function DraftPage({ params }: { params: Promise<{ year: string }> }) {
  const year = Number((await params).year);
  const s = season(year);
  const picks = draftPicksFor(year);
  if (!s || picks.length === 0) notFound();

  const teamCount = s.teams.length;
  const rounds = [...new Set(picks.map((p) => p.round))].sort((a, b) => a - b);
  const bySlot = new Map(picks.map((p) => [`${p.round}:${p.pickNo - (p.round - 1) * teamCount}`, p]));
  const boardViews = buildDraftBoardView(year);

  return (
    <>
      <PageTitle sub={`${picks.length} picks across ${rounds.length} rounds.`}>{year} draft</PageTitle>
      <Table caption={`${year} draft board`}>
        <thead>
          <tr>
            <th className={th}>Rd</th>
            {Array.from({ length: teamCount }, (_, i) => (
              <th key={i} className={th}>{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr key={r}>
              <td className={`${td} text-chalk-dim`}>{r}</td>
              {Array.from({ length: teamCount }, (_, i) => {
                const p = bySlot.get(`${r}:${i + 1}`);
                return (
                  <td key={i} className={td}>
                    {p && (
                      <div className="min-w-32">
                        <ManagerName id={p.managerId} plain />
                        {boardViews.get(p.playerId) ? (
                          <DraftBoardCell view={boardViews.get(p.playerId)} />
                        ) : (
                          <p className="text-sm text-chalk-dim">
                            {playerName(p.playerId)}
                            {playerPosition(p.playerId) && ` · ${playerPosition(p.playerId)}`}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
