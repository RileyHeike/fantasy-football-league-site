"use client";

import { formatPoints } from "@league/core";
import { GradeBadge, NABadge } from "./GradeBadge";
import { ManagerBadge } from "./ManagerBadge";
import { useModal } from "./modal/ModalProvider";
import { positionColor } from "@/lib/positions";
import type { DraftBoardPickView } from "@/lib/draftBoardView";

function StatLine({ entries }: { entries: DraftBoardPickView["statLine"] }) {
  if (!entries.length) return null;
  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-center sm:grid-cols-6">
      {entries.map((e, i) => (
        <div key={`${e.label}-${i}`}>
          <dd className="num font-display text-xl font-bold">{e.value}</dd>
          <dt className="text-xs text-chalk-dim">{e.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function PlayerLookup({ view, round, pickNo }: { view: DraftBoardPickView; round: number; pickNo: number }) {
  const hasFinish = view.points !== undefined;
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-chalk-dim">
            {view.position}
            {view.nflTeam && ` · ${view.nflTeam}`}
          </p>
          <div className="mt-2">
            <ManagerBadge name={view.managerName} colorIndex={view.colorIndex} sub="Drafted by" />
          </div>
        </div>
        {view.grade ? (
          <GradeBadge grade={view.grade.grade} color={view.grade.gradeColor} />
        ) : view.ungraded ? (
          <NABadge reasonLabel={view.ungraded.reasonLabel} />
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-chalk-dim">Round, pick</dt>
        <dd className="num text-right">
          {round}, {pickNo}
        </dd>
        <dt className="text-chalk-dim">Draft position</dt>
        <dd className="num text-right">{view.draftRankText}</dd>
        <dt className="text-chalk-dim">Season finish</dt>
        <dd className="num text-right">{view.finishRankText}</dd>
      </dl>

      {hasFinish ? (
        <div className="space-y-4 border-t border-yardline pt-4">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dd className="num font-display text-2xl font-extrabold">{formatPoints(view.points!)}</dd>
              <dt className="text-xs text-chalk-dim">points</dt>
            </div>
            <div>
              <dd className="num font-display text-2xl font-extrabold">{view.gamesPlayed}</dd>
              <dt className="text-xs text-chalk-dim">games</dt>
            </div>
            <div>
              <dd className="num font-display text-2xl font-extrabold">{view.pointsPerGameText}</dd>
              <dt className="text-xs text-chalk-dim">pts/gm</dt>
            </div>
          </dl>
          <StatLine entries={view.statLine} />
        </div>
      ) : (
        <p className="border-t border-yardline pt-4 text-sm text-chalk-dim">
          No stats recorded — the season may still be in progress, or the player never saw the field.
        </p>
      )}
    </div>
  );
}

/** A draft board cell: pick number, position accent, player name, and (if graded) a small grade indicator. Click opens a full season lookup. */
export function DraftBoardCell({ view, round, pickNo }: { view?: DraftBoardPickView; round: number; pickNo: number }) {
  const modal = useModal();
  if (!view) return null;
  return (
    <button
      type="button"
      onClick={() =>
        modal.open({ title: `${view.playerName} — ${view.position}`, content: <PlayerLookup view={view} round={round} pickNo={pickNo} />, wide: true })
      }
      className="block w-full border-l-[3px] py-0.5 pl-2 text-left transition-colors hover:bg-field-sunk"
      style={{ borderColor: positionColor(view.position) }}
    >
      <span className="num block text-xs text-chalk-dim">#{pickNo}</span>
      <span className="block truncate text-sm font-medium">{view.playerName}</span>
      {view.grade && (
        <span className="num block text-xs font-bold" style={{ color: view.grade.gradeColor }}>
          {view.grade.grade}
        </span>
      )}
    </button>
  );
}
