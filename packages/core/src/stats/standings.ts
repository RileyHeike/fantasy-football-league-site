import { round2 } from "../model/normalize";
import { defineStat, type Perspective, type StatContext } from "./context";

export interface RecordLine {
  managerId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  games: number;
  winPct: number;
}

export interface SeasonStanding extends RecordLine {
  rank: number;
  madePlayoffs: boolean;
  finish?: "champion" | "runnerUp" | "third" | "last";
}

export interface CareerLine extends RecordLine {
  seasons: number;
  championships: number;
  runnerUps: number;
  lastPlaces: number;
  playoffAppearances: number;
  playoffWins: number;
  playoffLosses: number;
  bestFinish: number | null;
}

export function tally(managerId: string, rows: Perspective[]): RecordLine {
  let wins = 0, losses = 0, ties = 0, pf = 0, pa = 0;
  for (const r of rows) {
    if (r.result === "W") wins++;
    else if (r.result === "L") losses++;
    else ties++;
    pf += r.pf;
    pa += r.pa;
  }
  const games = wins + losses + ties;
  return {
    managerId,
    wins,
    losses,
    ties,
    pointsFor: round2(pf),
    pointsAgainst: round2(pa),
    games,
    winPct: games ? round2((wins + ties / 2) / games) : 0,
  };
}

const byRecord = (a: RecordLine, b: RecordLine) =>
  b.winPct - a.winPct || b.pointsFor - a.pointsFor;

export function seasonStandings(ctx: StatContext, year: number): SeasonStanding[] {
  const season = ctx.seasonByYear.get(year);
  if (!season) return [];
  const rows = ctx.perspectives.filter((p) => p.game.season === year && p.game.kind === "regular");
  const playoffIds = new Set(
    ctx.playoffGames.filter((g) => g.season === year).flatMap((g) => [g.home.managerId, g.away.managerId]),
  );
  const pl = season.placements;
  return season.teams
    .map((t) => tally(t.managerId, rows.filter((r) => r.managerId === t.managerId)))
    .sort(byRecord)
    .map((line, i) => ({
      ...line,
      rank: i + 1,
      madePlayoffs: playoffIds.has(line.managerId),
      finish:
        pl.champion === line.managerId ? "champion"
        : pl.runnerUp === line.managerId ? "runnerUp"
        : pl.third === line.managerId ? "third"
        : pl.last === line.managerId ? "last"
        : undefined,
    }));
}

export const standings = defineStat({
  id: "standings",
  title: "Standings",
  description: "Regular-season standings per season, and career totals.",
  compute(ctx) {
    const bySeason: Record<number, SeasonStanding[]> = {};
    for (const s of ctx.league.seasons) bySeason[s.year] = seasonStandings(ctx, s.year);

    const career: CareerLine[] = ctx.league.managers.map((m) => {
      const regular = ctx.perspectives.filter((p) => p.managerId === m.id && p.game.kind === "regular");
      const playoff = ctx.perspectives.filter((p) => p.managerId === m.id && p.game.kind === "playoff");
      const seasons = ctx.league.seasons.filter((s) => s.teams.some((t) => t.managerId === m.id));
      const finishes = Object.values(bySeason).flat().filter((l) => l.managerId === m.id);
      const bestRank = (s: number): number | null => {
        const p = ctx.seasonByYear.get(s)!.placements;
        if (p.champion === m.id) return 1;
        if (p.runnerUp === m.id) return 2;
        if (p.third === m.id) return 3;
        return null;
      };
      const best = seasons.map((s) => bestRank(s.year)).filter((x): x is number => x !== null);
      return {
        ...tally(m.id, regular),
        seasons: seasons.length,
        championships: seasons.filter((s) => s.placements.champion === m.id).length,
        runnerUps: seasons.filter((s) => s.placements.runnerUp === m.id).length,
        lastPlaces: seasons.filter((s) => s.placements.last === m.id).length,
        playoffAppearances: finishes.filter((f) => f.madePlayoffs).length,
        playoffWins: playoff.filter((p) => p.result === "W").length,
        playoffLosses: playoff.filter((p) => p.result === "L").length,
        bestFinish: best.length ? Math.min(...best) : null,
      };
    });
    career.sort((a, b) => b.championships - a.championships || byRecord(a, b));
    return { bySeason, career };
  },
});
