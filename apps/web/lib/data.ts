import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertSnapshot, formatPoints, gradedPicksForSeason, pickDetailsForSeason, type BracketMatch, type DraftPick, type Game, type GameSide, type LeagueRecord, type LeagueSnapshot, type Manager, type ManagerCareerGrade, type ManagerSeasonGrade, type PickGrade, type Season, type Transaction, type UngradedReason } from "@league/core";
import type { DraftBoardPickView } from "./draftBoardView";
import type { DraftGradeCareerRowView, DraftGradeLeaderboardView, DraftGradePickRowView, DraftGradeSeasonRowView } from "./draftGradeView";
import { gradeColor } from "./grades";
import type { MatchupData, MatchupSide } from "./matchup";
import type { RecordCardView, RecordRowView } from "./recordView";
import { statLineFor } from "./statLine";

/**
 * Build-time data access. Pages are statically rendered, so the snapshot is
 * read once per build and never shipped whole to the browser.
 */
let cached: LeagueSnapshot | null = null;

export function snapshot(): LeagueSnapshot {
  if (cached) return cached;
  const path = process.env.SNAPSHOT_PATH ?? join(process.cwd(), "../../data/snapshot.json");
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`No league snapshot at ${path}. Run "npm run sync:fixture" (demo) or "npm run sync" first.`);
  }
  assertSnapshot(json);
  cached = json;
  return json;
}

export const league = () => snapshot().league;
export const stats = () => snapshot().stats;

export function manager(id: string): Manager {
  const m = league().managers.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown manager ${id}`);
  return m;
}

export const seasons = (): Season[] => [...league().seasons].sort((a, b) => b.year - a.year);
export const season = (year: number) => league().seasons.find((s) => s.year === year);
export const currentSeason = (): Season => seasons()[0]!;
export const completedSeasons = () => seasons().filter((s) => s.status === "complete");

/** Team name a manager used in a given season. */
export function teamName(managerId: string, year: number): string {
  return season(year)?.teams.find((t) => t.managerId === managerId)?.teamName ?? manager(managerId).name;
}

export function gamesFor(year: number, week?: number): Game[] {
  return league().games.filter((g) => g.season === year && (week === undefined || g.week === week));
}

export function playerName(id: string): string {
  return league().players[id]?.name ?? (/^[A-Z]{2,3}$/.test(id) ? `${id} D/ST` : `Player ${id}`);
}

export function playerPosition(id: string): string | undefined {
  return league().players[id]?.position ?? (/^[A-Z]{2,3}$/.test(id) ? "DEF" : undefined);
}

/** The scored Game behind a bracket match, once both sides are known. */
export function bracketGame(year: number, b: BracketMatch): Game | undefined {
  if (!b.team1 || !b.team2) return undefined;
  const s = season(year);
  if (!s) return undefined;
  const week = s.regularSeasonWeeks + b.round;
  const pair = [b.team1, b.team2].sort().join();
  return gamesFor(year, week).find(
    (g) => (g.kind === "playoff" || g.kind === "consolation") && [g.home.managerId, g.away.managerId].sort().join() === pair,
  );
}

export function transactionsFor(year: number): Transaction[] {
  return [...league().transactions.filter((t) => t.season === year)].sort((a, b) => b.created - a.created);
}

export function draftPicksFor(year: number): DraftPick[] {
  return league().draftPicks.filter((p) => p.season === year);
}

export function hasDraft(year: number): boolean {
  return draftPicksFor(year).length > 0;
}

/** Plain season summary for the draft board's click-through modal, every position — keyed by playerId. */
export function buildDraftBoardView(year: number): Map<string, DraftBoardPickView> {
  const { draftPicks, playerSeasonFinishes, players } = league();
  const details = pickDetailsForSeason(draftPicks, playerSeasonFinishes, players, year);
  const gradeByPlayerId = new Map(gradedPicksForSeason(draftPicks, playerSeasonFinishes, players, year).map((g) => [g.playerId, g]));

  const out = new Map<string, DraftBoardPickView>();
  for (const d of details) {
    const m = manager(d.managerId);
    const g = gradeByPlayerId.get(d.playerId);
    out.set(d.playerId, {
      playerId: d.playerId,
      playerName: playerName(d.playerId),
      position: d.position,
      nflTeam: players[d.playerId]?.team ?? undefined,
      managerId: d.managerId,
      managerName: m.name,
      colorIndex: m.colorIndex,
      draftRankText: `${d.position}${d.draftRank}`,
      finishRankText: d.finish ? `${d.position}${d.finish.finishRank}` : "N/A",
      pointsPerGameText: d.finish ? formatPoints(d.finish.pointsPerGame) : "N/A",
      points: d.finish?.points,
      gamesPlayed: d.finish?.gamesPlayed,
      statLine: d.finish ? statLineFor(d.position, d.finish.rawStats) : [],
      grade: g?.graded ? { grade: g.grade, gradeColor: gradeColor(g.grade) } : undefined,
      ungraded: g && !g.graded ? { reasonLabel: UNGRADED_REASON_LABELS[g.reason] } : undefined,
    });
  }
  return out;
}

export function gameById(id: string): Game | undefined {
  return league().games.find((g) => g.id === id);
}

/** A manager's last game played in a season — regular season finale, or their last playoff/consolation game. */
export function finalGameFor(managerId: string, year: number): Game | undefined {
  return gamesFor(year)
    .filter((g) => g.final && (g.home.managerId === managerId || g.away.managerId === managerId))
    .sort((a, b) => b.week - a.week)[0];
}

function matchupSide(g: Game, s: GameSide): MatchupSide {
  const m = manager(s.managerId);
  const opponent = g.home.managerId === s.managerId ? g.away : g.home;
  const line = (p: { playerId: string; points: number }) => ({
    playerId: p.playerId,
    name: playerName(p.playerId),
    position: playerPosition(p.playerId),
    points: p.points,
  });
  return {
    managerId: s.managerId,
    managerName: m.name,
    colorIndex: m.colorIndex,
    teamName: teamName(s.managerId, g.season),
    points: s.points,
    // Ahead on points, not just the final winner — keeps a leader highlighted while a week is still live.
    won: s.points > opponent.points,
    starters: (s.starters ?? []).map(line),
    bench: (s.bench ?? []).map(line),
  };
}

/** Plain, serializable snapshot of a game for client-rendered modals (see lib/matchup.ts). */
export function buildMatchup(g: Game, label?: string): MatchupData {
  const kindLabel = g.kind === "playoff" ? "Playoffs" : g.kind === "consolation" ? "Consolation" : undefined;
  return {
    id: g.id,
    label: label ?? `Week ${g.week}, ${g.season}${kindLabel ? ` · ${kindLabel}` : ""}`,
    final: g.final,
    home: matchupSide(g, g.home),
    away: matchupSide(g, g.away),
  };
}

type RecordHolder = Omit<LeagueRecord, "runnersUp" | "label" | "category" | "unit" | "id">;

function whenText(h: RecordHolder): string {
  if (h.week !== undefined && h.endWeek !== undefined) {
    if (h.endSeason === h.season) {
      return h.week === h.endWeek ? `Week ${h.week}, ${h.season}` : `Weeks ${h.week}–${h.endWeek}, ${h.season}`;
    }
    return `Week ${h.week}, ${h.season} – Week ${h.endWeek}, ${h.endSeason}`;
  }
  return h.week ? `Week ${h.week}, ${h.season}` : String(h.season);
}

/** Plain, serializable view of a record's top-10 leaderboard, with matchups resolved for drill-down rows. */
export function buildRecordCard(r: LeagueRecord): RecordCardView {
  const fmtValue = (v: number) => (r.unit === "pts" ? formatPoints(v) : String(v));
  const holders: RecordHolder[] = [
    { value: r.value, managerId: r.managerId, opponentId: r.opponentId, season: r.season, week: r.week, gameId: r.gameId, endSeason: r.endSeason, endWeek: r.endWeek },
    ...r.runnersUp,
  ];
  const rows: RecordRowView[] = holders.map((h, i) => {
    const m = manager(h.managerId);
    let matchup: MatchupData | undefined;
    if (r.category === "game" && h.gameId) {
      const g = gameById(h.gameId);
      if (g) matchup = buildMatchup(g);
    } else if (r.category === "season") {
      const g = finalGameFor(h.managerId, h.season);
      if (g) matchup = buildMatchup(g, `${m.name} — final week of ${h.season}`);
    }
    return { rank: i + 1, managerId: h.managerId, managerName: m.name, colorIndex: m.colorIndex, valueText: fmtValue(h.value), whenText: whenText(h), matchup };
  });
  return {
    id: r.id,
    label: r.label,
    category: r.category,
    valueText: fmtValue(r.value),
    whenText: whenText(r),
    managerName: rows[0]!.managerName,
    colorIndex: rows[0]!.colorIndex,
    rows,
  };
}

const UNGRADED_REASON_LABELS: Record<UngradedReason, string> = {
  "no-finish-data": "No stats recorded",
  "insufficient-games-played": "Played less than half the season",
};

function draftGradePickRow(p: PickGrade): DraftGradePickRowView {
  const base = {
    playerId: p.playerId,
    playerName: playerName(p.playerId),
    position: p.position,
    round: p.round,
    pickNo: p.pickNo,
    draftRankText: `${p.position}${p.draftRank}`,
    finishRankText: p.finish ? `${p.position}${p.finish.finishRank}` : "N/A",
  };
  if (p.graded) return { ...base, graded: true, grade: p.grade, gradeColor: gradeColor(p.grade) };
  return { ...base, graded: false, reasonLabel: UNGRADED_REASON_LABELS[p.reason] };
}

function draftGradeSeasonRow(row: ManagerSeasonGrade): DraftGradeSeasonRowView {
  const m = manager(row.managerId);
  return {
    managerId: row.managerId,
    managerName: m.name,
    colorIndex: m.colorIndex,
    season: row.season,
    pickCount: row.pickCount,
    grade: row.grade,
    gradeColor: gradeColor(row.grade),
    picks: row.picks.map(draftGradePickRow),
  };
}

function draftGradeCareerRow(row: ManagerCareerGrade, seasons: DraftGradeSeasonRowView[]): DraftGradeCareerRowView {
  const m = manager(row.managerId);
  return {
    managerId: row.managerId,
    managerName: m.name,
    colorIndex: m.colorIndex,
    pickCount: row.pickCount,
    grade: row.grade,
    gradeColor: gradeColor(row.grade),
    seasons,
  };
}

/** Plain, serializable leaderboard for the draft grades page: all-time plus per-season breakdowns. */
export function buildDraftGradeLeaderboard(): DraftGradeLeaderboardView {
  const { bySeason, career } = stats().draftGrades;
  const seasons = Object.keys(bySeason)
    .map(Number)
    .sort((a, b) => b - a)
    .map((season) => ({ season, rows: bySeason[season]!.map(draftGradeSeasonRow) }));

  const seasonsByManager = new Map<string, DraftGradeSeasonRowView[]>();
  for (const { rows } of seasons) {
    for (const row of rows) seasonsByManager.set(row.managerId, [...(seasonsByManager.get(row.managerId) ?? []), row]);
  }

  return { career: career.map((row) => draftGradeCareerRow(row, seasonsByManager.get(row.managerId) ?? [])), seasons };
}
