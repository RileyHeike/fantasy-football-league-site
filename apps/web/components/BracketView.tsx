import { formatPoints, ordinal, type BracketMatch } from "@league/core";
import { ManagerName } from "./ui";
import { bracketGame } from "@/lib/data";

function roundLabel(b: BracketMatch, maxRound: number): string {
  if (b.placement === 1) return "Championship";
  if (b.placement === 3) return "Third place";
  if (b.placement) return `${ordinal(b.placement)} place`;
  return b.round === maxRound ? "Semifinals" : `Round ${b.round}`;
}

/** Playoff or consolation bracket, grouped into round columns. Shows scores once both sides are known. */
export function BracketView({ bracket, year }: { bracket: BracketMatch[]; year: number }) {
  if (bracket.length === 0) return null;
  const maxRound = Math.max(...bracket.map((b) => b.round));
  const rounds = [...new Set(bracket.map((b) => b.round))].sort((a, b) => a - b);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map((r) => (
        <div key={r} className="flex min-w-56 flex-1 flex-col gap-3">
          {bracket
            .filter((b) => b.round === r)
            .sort((a, b) => a.match - b.match)
            .map((b) => (
              <BracketCard key={b.match} b={b} year={year} label={roundLabel(b, maxRound)} />
            ))}
        </div>
      ))}
    </div>
  );
}

function BracketCard({ b, year, label }: { b: BracketMatch; year: number; label: string }) {
  const g = bracketGame(year, b);
  const isFinal = b.placement === 1;
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${isFinal ? "border-gold" : "border-yardline"}`}>
      <p className={`mb-1.5 text-xs ${isFinal ? "text-gold" : "text-chalk-dim"}`}>{label}</p>
      {([b.team1, b.team2] as const).map((teamId, i) => {
        const points = g ? (g.home.managerId === teamId ? g.home.points : g.away.points) : undefined;
        const won = teamId != null && b.winnerId === teamId;
        return (
          <div key={i} className="flex items-center justify-between gap-2 py-0.5">
            {teamId ? (
              <ManagerName id={teamId} plain />
            ) : (
              <span className="text-sm text-chalk-dim">TBD</span>
            )}
            {points !== undefined && (
              <span className={`num text-sm font-semibold ${won ? "" : "text-chalk-dim"}`}>{formatPoints(points)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
