import { defineStat } from "./context";

export interface TrophyCase {
  season: number;
  champion?: string;
  runnerUp?: string;
  third?: string;
  last?: string;
  /** Championship game score, when found. */
  final?: { gameId: string; winnerPoints: number; loserPoints: number };
}

export const trophies = defineStat({
  id: "trophies",
  title: "Trophy room",
  description: "Champions, runners-up and last-place finishers by season.",
  compute(ctx): TrophyCase[] {
    return ctx.league.seasons
      .filter((s) => s.status === "complete")
      .map((s) => {
        const g = ctx.playoffGames.find((x) => x.season === s.year && x.placement === 1);
        const w = g && (g.winnerId === g.home.managerId ? g.home : g.away);
        const l = g && (g.winnerId === g.home.managerId ? g.away : g.home);
        return {
          season: s.year,
          ...s.placements,
          final: g && w && l ? { gameId: g.id, winnerPoints: w.points, loserPoints: l.points } : undefined,
        };
      })
      .reverse();
  },
});
