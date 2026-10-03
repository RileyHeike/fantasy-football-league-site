import { formatPoints } from "@league/core";
import { ManagerBadge } from "./ManagerBadge";
import { MatchupTrigger } from "./MatchupTrigger";
import type { MatchupData } from "@/lib/matchup";

/** Click a matchup to see the full box score. `matchups` are built server-side via lib/data's buildMatchup. */
export function Scoreboard({ matchups }: { matchups: MatchupData[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {matchups.map((m) => (
        <li key={m.id}>
          <MatchupTrigger
            matchup={m}
            className="block w-full rounded-lg border border-yardline bg-field-raised px-4 py-3 text-left transition-colors hover:border-chalk-dim"
          >
            {([m.home, m.away] as const).map((side) => (
              <div key={side.managerId} className="flex items-center justify-between gap-3 py-1">
                <ManagerBadge name={side.managerName} colorIndex={side.colorIndex} sub={side.teamName} />
                <span className={`num font-display text-2xl font-bold ${side.won ? "" : "text-chalk-dim"}`}>
                  {formatPoints(side.points)}
                </span>
              </div>
            ))}
            <p className="mt-1 text-xs text-chalk-dim">{m.final ? "Final" : "In progress"}</p>
          </MatchupTrigger>
        </li>
      ))}
    </ul>
  );
}
