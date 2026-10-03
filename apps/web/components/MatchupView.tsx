import { formatPoints } from "@league/core";
import { ManagerBadge } from "./ManagerBadge";
import { PositionTag } from "./PositionTag";
import { jersey } from "@/lib/palette";
import type { MatchupData, MatchupPlayerLine, MatchupSide } from "@/lib/matchup";

/** Box score for a MatchupData. Client-safe — pure presentational, used standalone and inside modals. */
export function MatchupView({ matchup }: { matchup: MatchupData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MatchupSideView side={matchup.home} />
      <MatchupSideView side={matchup.away} />
    </div>
  );
}

function MatchupSideView({ side }: { side: MatchupSide }) {
  return (
    <div className="overflow-hidden rounded-lg border border-yardline">
      <div className="h-1" style={{ background: jersey(side.colorIndex) }} />
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <ManagerBadge name={side.managerName} colorIndex={side.colorIndex} sub={side.teamName} />
          <span className={`num font-display text-3xl font-bold ${side.won ? "" : "text-chalk-dim"}`}>
            {formatPoints(side.points)}
          </span>
        </div>

        {side.starters.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-chalk-dim">Starters</p>
            <ul className="divide-y divide-yardline/60 text-sm">
              {side.starters.map((p) => (
                <PlayerRow key={p.playerId} p={p} />
              ))}
            </ul>
          </div>
        )}

        {side.bench.length > 0 && (
          <div className="mt-4 hidden lg:block">
            <p className="mb-1 text-xs text-chalk-dim">Bench</p>
            <ul className="divide-y divide-yardline/60 text-sm text-chalk-dim">
              {side.bench.map((p) => (
                <PlayerRow key={p.playerId} p={p} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerRow({ p }: { p: MatchupPlayerLine }) {
  return (
    <li className="flex items-center gap-2 py-1.5">
      <span className="min-w-0 flex-1 truncate">{p.name}</span>
      <PositionTag position={p.position} />
      <span className="num w-12 shrink-0 text-right">{formatPoints(p.points)}</span>
    </li>
  );
}
