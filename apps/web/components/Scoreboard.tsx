import { formatPoints, type Game } from "@league/core";
import { ManagerName } from "./ui";
import { teamName } from "@/lib/data";

export function Scoreboard({ games }: { games: Game[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {games.map((g) => {
        const lead = g.home.points === g.away.points ? null : g.home.points > g.away.points ? "home" : "away";
        return (
          <li key={g.id} className="rounded-lg border border-yardline bg-field-raised px-4 py-3">
            {(["home", "away"] as const).map((s) => {
              const side = g[s];
              const ahead = lead === s;
              return (
                <div key={s} className="flex items-center justify-between gap-3 py-1">
                  <ManagerName id={side.managerId} sub={teamName(side.managerId, g.season)} />
                  <span className={`num font-display text-2xl font-bold ${ahead ? "" : "text-chalk-dim"}`}>
                    {formatPoints(side.points)}
                  </span>
                </div>
              );
            })}
            <p className="mt-1 text-xs text-chalk-dim">{g.final ? "Final" : "In progress"}</p>
          </li>
        );
      })}
    </ul>
  );
}
