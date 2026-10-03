import { round2 } from "../model/normalize";
import { defineStat } from "./context";

export interface AdvancedLine {
  managerId: string;
  season: number;
  games: number;
  avgPoints: number;
  /** Points standard deviation: lower = more consistent. */
  stdDev: number;
  allPlayWins: number;
  allPlayLosses: number;
  allPlayPct: number;
  actualWins: number;
  /** Wins expected from all-play win% x games played. */
  expectedWins: number;
  /** actual - expected. Positive = lucky. */
  luck: number;
  /** Starter points / best possible lineup points, when per-player data exists. */
  lineupEfficiency?: number;
  benchPoints?: number;
}

/**
 * All-play: each week, a team "plays" every other team. Its all-play win% is
 * how often it would have won, independent of schedule. Luck compares that
 * expectation to real wins.
 */
export const advanced = defineStat({
  id: "advanced",
  title: "Advanced stats",
  description: "All-play record, luck, consistency and lineup efficiency per season.",
  compute(ctx) {
    const lines: AdvancedLine[] = [];
    for (const s of ctx.league.seasons) {
      const games = ctx.regularGames.filter((g) => g.season === s.year);
      const weeks = new Map<number, { managerId: string; points: number }[]>();
      for (const g of games) {
        const list = weeks.get(g.week) ?? [];
        list.push({ managerId: g.home.managerId, points: g.home.points }, { managerId: g.away.managerId, points: g.away.points });
        weeks.set(g.week, list);
      }
      for (const t of s.teams) {
        let apW = 0, apL = 0, actual = 0, played = 0;
        const scores: number[] = [];
        let starterPts = 0, benchPts = 0, hasPlayers = false;
        for (const list of weeks.values()) {
          const me = list.find((x) => x.managerId === t.managerId);
          if (!me) continue;
          played++;
          scores.push(me.points);
          for (const o of list) {
            if (o.managerId === t.managerId) continue;
            if (me.points > o.points) apW++;
            else if (me.points < o.points) apL++;
            else { apW += 0.5; apL += 0.5; }
          }
        }
        for (const g of games) {
          const side = g.home.managerId === t.managerId ? g.home : g.away.managerId === t.managerId ? g.away : null;
          if (!side) continue;
          if (g.winnerId === t.managerId) actual++;
          else if (g.winnerId === null) actual += 0.5;
          if (side.starters && side.bench) {
            hasPlayers = true;
            starterPts += side.points;
            benchPts += side.bench.reduce((n, b) => n + b.points, 0);
          }
        }
        if (!played) continue;
        const avg = scores.reduce((a, b) => a + b, 0) / played;
        const sd = Math.sqrt(scores.reduce((a, b) => a + (b - avg) ** 2, 0) / played);
        const apPct = apW + apL ? apW / (apW + apL) : 0;
        const expected = apPct * played;
        lines.push({
          managerId: t.managerId,
          season: s.year,
          games: played,
          avgPoints: round2(avg),
          stdDev: round2(sd),
          allPlayWins: round2(apW),
          allPlayLosses: round2(apL),
          allPlayPct: round2(apPct),
          actualWins: actual,
          expectedWins: round2(expected),
          luck: round2(actual - expected),
          ...(hasPlayers ? { benchPoints: round2(benchPts) } : {}),
        });
      }
    }
    return lines;
  },
});
