import { notFound } from "next/navigation";
import { DraftBoardCell } from "@/components/DraftBoardCell";
import { ManagerBadge } from "@/components/ManagerBadge";
import { PageTitle, td, th } from "@/components/ui";
import { buildDraftBoardView, draftPicksFor, league, manager, playerName, playerPosition, season } from "@/lib/data";

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
  // Each manager keeps one fixed column (their draftSlot) for the whole draft — the snake order shows
  // up in how pick numbers alternate ascending/descending across a row, not in the column order.
  const bySlot = new Map(picks.map((p) => [`${p.round}:${p.draftSlot}`, p]));
  const managerBySlot = new Map(picks.map((p) => [p.draftSlot, p.managerId]));
  const boardViews = buildDraftBoardView(year);

  return (
    <>
      <PageTitle sub={`${picks.length} picks across ${rounds.length} rounds, snake order.`}>{year} draft</PageTitle>
      {/*
        Not using the shared <Table> here: its border-collapse breaks `position: sticky` on <th>/<td>
        in every major browser. border-separate + border-spacing-0 is the standard fix, and this grid's
        cells are already fully custom, so there's nothing else to share with <Table> anyway. A capped
        height keeps the sticky header/column scoped to an explicit scroll container.
      */}
      <div className="max-h-[80vh] overflow-auto rounded-lg border border-yardline">
        <table className="w-full border-separate border-spacing-0 text-left text-[15px]">
          <caption className="sr-only">{`${year} draft board`}</caption>
          <thead>
            <tr>
              <th className={`${th} sticky left-0 top-0 z-20 bg-field`}>Rd</th>
              {Array.from({ length: teamCount }, (_, i) => {
                const slot = i + 1;
                const managerId = managerBySlot.get(slot);
                const m = managerId ? manager(managerId) : undefined;
                return (
                  <th key={slot} className={`${th} sticky top-0 z-10 min-w-32 bg-field`}>
                    {m && <ManagerBadge name={m.name} colorIndex={m.colorIndex} />}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r}>
                <td className={`${td} sticky left-0 z-[1] bg-field text-chalk-dim`}>{r}</td>
                {Array.from({ length: teamCount }, (_, i) => {
                  const slot = i + 1;
                  const p = bySlot.get(`${r}:${slot}`);
                  const view = p && boardViews.get(p.playerId);
                  return (
                    <td key={slot} className={td}>
                      {p &&
                        (view ? (
                          <DraftBoardCell view={view} round={p.round} pickNo={p.pickNo} />
                        ) : (
                          <p className="text-sm text-chalk-dim">
                            {playerName(p.playerId)}
                            {playerPosition(p.playerId) && ` · ${playerPosition(p.playerId)}`}
                          </p>
                        ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
