import { formatPoints } from "@league/core";
import { ManagerBadge } from "./ManagerBadge";
import type { MatchupData, MatchupSide } from "@/lib/matchup";

/** Box score for a MatchupData. Client-safe — pure presentational, used standalone and inside modals. */
export function MatchupView({ matchup }: { matchup: MatchupData }) {
  return (
    <div>
      <p className="mb-3 text-sm text-chalk-dim">{matchup.label}{!matchup.final && " · In progress"}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <MatchupSideView side={matchup.home} />
        <MatchupSideView side={matchup.away} />
      </div>
    </div>
  );
}

function MatchupSideView({ side }: { side: MatchupSide }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <ManagerBadge name={side.managerName} colorIndex={side.colorIndex} sub={side.teamName} />
        <span className={`num font-display text-3xl font-bold ${side.won ? "" : "text-chalk-dim"}`}>
          {formatPoints(side.points)}
        </span>
      </div>
      {side.starters.length > 0 && (
        <ul className="space-y-0.5 border-t border-yardline pt-2 text-sm">
          {side.starters.map((p) => (
            <li key={p.playerId} className="flex items-center justify-between gap-3 text-chalk-dim">
              <span>
                {p.name}
                {p.position && <span className="ml-1 text-xs">{p.position}</span>}
              </span>
              <span className="num">{formatPoints(p.points)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
