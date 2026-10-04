"use client";

import { ManagerBadge } from "./ManagerBadge";
import { useModal } from "./modal/ModalProvider";
import type { DraftGradeCareerRowView, DraftGradePickRowView, DraftGradeSeasonRowView } from "@/lib/draftGradeView";

function GradeBadge({ grade, color }: { grade: string; color: string }) {
  return (
    <span
      className="num inline-flex min-w-10 items-center justify-center rounded px-2 py-1 text-center font-display text-lg font-bold"
      style={{ background: `${color}26`, color }}
    >
      {grade}
    </span>
  );
}

function PickList({ picks }: { picks: DraftGradePickRowView[] }) {
  return (
    <ol className="space-y-1 text-sm">
      {picks.map((p) => (
        <li key={p.playerId} className="flex items-center justify-between gap-3 px-2 py-1.5">
          <span>
            <span className="font-medium">{p.playerName}</span>
            <span className="block text-xs text-chalk-dim">
              Round {p.round}, Pick {p.pickNo} · Drafted {p.draftRankText} → finished {p.finishRankText}
            </span>
          </span>
          <GradeBadge grade={p.grade} color={p.gradeColor} />
        </li>
      ))}
    </ol>
  );
}

function SeasonList({ seasons }: { seasons: DraftGradeSeasonRowView[] }) {
  const modal = useModal();
  return (
    <ol className="space-y-1 text-sm">
      {seasons.map((s) => (
        <li key={s.season}>
          <button
            type="button"
            onClick={() => modal.push({ title: `${s.managerName} — ${s.season} draft`, content: <PickList picks={s.picks} /> })}
            className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left hover:bg-field-sunk"
          >
            <span className="num w-16 text-chalk-dim">{s.season}</span>
            <span className="flex-1 text-chalk-dim">{s.pickCount} graded {s.pickCount === 1 ? "pick" : "picks"}</span>
            <GradeBadge grade={s.grade} color={s.gradeColor} />
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Career leaderboard card for one manager: opens their season-by-season grades, then that season's picks. */
export function DraftGradeExplorer({ row }: { row: DraftGradeCareerRowView }) {
  const modal = useModal();
  return (
    <button
      type="button"
      onClick={() => modal.open({ title: `${row.managerName} — draft history`, content: <SeasonList seasons={row.seasons} /> })}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-yardline p-4 text-left transition-colors hover:border-chalk-dim"
    >
      <ManagerBadge name={row.managerName} colorIndex={row.colorIndex} sub={`${row.pickCount} graded picks`} />
      <GradeBadge grade={row.grade} color={row.gradeColor} />
    </button>
  );
}

/** One season's leaderboard row, independent of the career drill-down — opens that season's picks directly. */
export function DraftGradeSeasonExplorer({ row }: { row: DraftGradeSeasonRowView }) {
  const modal = useModal();
  return (
    <button
      type="button"
      onClick={() => modal.open({ title: `${row.managerName} — ${row.season} draft`, content: <PickList picks={row.picks} /> })}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-yardline p-4 text-left transition-colors hover:border-chalk-dim"
    >
      <ManagerBadge name={row.managerName} colorIndex={row.colorIndex} sub={`${row.pickCount} graded ${row.pickCount === 1 ? "pick" : "picks"}`} />
      <GradeBadge grade={row.grade} color={row.gradeColor} />
    </button>
  );
}
