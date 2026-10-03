import { round2 } from "../model/normalize";
import { defineStat, type Perspective, type StatContext } from "./context";

export interface LeagueRecord {
  id: string;
  label: string;
  category: "game" | "season" | "streak";
  value: number;
  unit: "pts" | "wins" | "losses" | "games";
  managerId: string;
  opponentId?: string;
  season: number;
  week?: number;
  gameId?: string;
  /** End of the range, for streak records (week/season may differ from the start above). */
  endSeason?: number;
  endWeek?: number;
  /** Top N holders so pages can show a leaderboard, best first. */
  runnersUp: Omit<LeagueRecord, "runnersUp" | "label" | "category" | "unit" | "id">[];
}

type Holder = LeagueRecord["runnersUp"][number];

const TOP = 10;

function gameRecord(
  ctx: StatContext,
  id: string,
  label: string,
  rows: Perspective[],
  score: (p: Perspective) => number,
  dir: "max" | "min",
): LeagueRecord | null {
  const sorted = [...rows].sort((a, b) => (dir === "max" ? score(b) - score(a) : score(a) - score(b)));
  const holders: Holder[] = sorted.slice(0, TOP).map((p) => ({
    value: round2(score(p)),
    managerId: p.managerId,
    opponentId: p.opponentId,
    season: p.game.season,
    week: p.game.week,
    gameId: p.game.id,
  }));
  const [first, ...rest] = holders;
  if (!first) return null;
  return { id, label, category: "game", unit: "pts", ...first, runnersUp: rest };
}

function longestStreaks(ctx: StatContext, want: "W" | "L"): Holder[] {
  const best: Holder[] = [];
  for (const m of ctx.league.managers) {
    const rows = ctx.perspectives
      .filter((p) => p.managerId === m.id && p.game.kind === "regular")
      .sort((a, b) => a.game.season - b.game.season || a.game.week - b.game.week);
    let run = 0;
    let start: Perspective | undefined;
    let end: Perspective | undefined;
    const close = () => {
      if (run > 0 && start && end) {
        best.push({
          value: run,
          managerId: m.id,
          season: start.game.season,
          week: start.game.week,
          endSeason: end.game.season,
          endWeek: end.game.week,
        });
      }
    };
    for (const r of rows) {
      if (r.result === want) {
        if (run === 0) start = r;
        end = r;
        run++;
      } else {
        close();
        run = 0;
      }
    }
    close();
  }
  return best.sort((a, b) => b.value - a.value).slice(0, TOP);
}

export const records = defineStat({
  id: "records",
  title: "Record book",
  description: "Single-game, season and streak records with top-5 leaderboards.",
  compute(ctx): LeagueRecord[] {
    const all = ctx.perspectives;
    const regular = all.filter((p) => p.game.kind === "regular");
    // Count each game once for margin-based records (winner's perspective).
    const winners = all.filter((p) => p.result === "W");
    const out: (LeagueRecord | null)[] = [
      gameRecord(ctx, "high-score", "Highest score", all, (p) => p.pf, "max"),
      gameRecord(ctx, "low-score", "Lowest score", regular, (p) => p.pf, "min"),
      gameRecord(ctx, "biggest-blowout", "Biggest blowout", winners, (p) => p.pf - p.pa, "max"),
      gameRecord(ctx, "closest-game", "Closest win", winners, (p) => p.pf - p.pa, "min"),
      gameRecord(ctx, "most-in-loss", "Most points in a loss", all.filter((p) => p.result === "L"), (p) => p.pf, "max"),
      gameRecord(ctx, "fewest-in-win", "Fewest points in a win", winners, (p) => p.pf, "min"),
      gameRecord(ctx, "highest-combined", "Highest combined score", winners, (p) => p.pf + p.pa, "max"),
    ];

    // Season totals (regular season only)
    const seasonTotals: Holder[] = [];
    for (const s of ctx.league.seasons) {
      if (s.status !== "complete") continue;
      for (const t of s.teams) {
        const pf = regular
          .filter((p) => p.game.season === s.year && p.managerId === t.managerId)
          .reduce((n, p) => n + p.pf, 0);
        seasonTotals.push({ value: round2(pf), managerId: t.managerId, season: s.year });
      }
    }
    const desc = [...seasonTotals].sort((a, b) => b.value - a.value);
    const asc = [...seasonTotals].sort((a, b) => a.value - b.value);
    const seasonRec = (id: string, label: string, list: Holder[]): LeagueRecord | null =>
      list[0] ? { id, label, category: "season", unit: "pts", ...list[0], runnersUp: list.slice(1, TOP) } : null;
    out.push(seasonRec("most-season-points", "Most points in a season", desc));
    out.push(seasonRec("fewest-season-points", "Fewest points in a season", asc));

    const ws = longestStreaks(ctx, "W");
    const ls = longestStreaks(ctx, "L");
    if (ws[0]) out.push({ id: "win-streak", label: "Longest winning streak", category: "streak", unit: "wins", ...ws[0], runnersUp: ws.slice(1) });
    if (ls[0]) out.push({ id: "losing-streak", label: "Longest losing streak", category: "streak", unit: "losses", ...ls[0], runnersUp: ls.slice(1) });

    return out.filter((r): r is LeagueRecord => r !== null);
  },
});
