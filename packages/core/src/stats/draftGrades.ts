import { round2 } from "../model/normalize";
import { defineStat } from "./context";
import type { DraftPick, LeagueHistory, PlayerInfo, PlayerSeasonFinish } from "../model/types";
import { DEFAULT_DRAFT_GRADE_CONFIG, type DraftGradeConfig, type Grade, type GradedPosition } from "./draftGradeConfig";

export interface PickFinish {
  /** 1 = the best fantasy season at this position that year. */
  finishRank: number;
  points: number;
  gamesPlayed: number;
  pointsPerGame: number;
  /** The player's full raw per-category stat line that season, verbatim — see PlayerSeasonFinish.rawStats. */
  rawStats: Record<string, number>;
}

export interface PickDetail {
  season: number;
  pickNo: number;
  round: number;
  managerId: string;
  playerId: string;
  /** Any fantasy position, not just graded ones — this layer is unscoped so K/DEF get ranks too. */
  position: string;
  /** 1 = first player at this position taken that season. */
  draftRank: number;
  /** Picks at this position that season — the normalization denominator. */
  poolSize: number;
  /** Absent when the player has no season finish data at all (never played, cut, retired). */
  finish?: PickFinish;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Every pick, every position, bucketed by draft order within that position
 * (prefer the position a player was actually ranked under that season over
 * his draft-time position; a pick without finish data still occupies a slot
 * that shifts later picks' ranks). Powers both draft grades and the
 * draft-board click-through lookup.
 */
export function pickDetailsForSeason(
  picks: DraftPick[],
  finishes: PlayerSeasonFinish[],
  players: Record<string, PlayerInfo>,
  season: number,
): PickDetail[] {
  const seasonPicks = picks.filter((p) => p.season === season);
  const finishByPlayer = new Map(finishes.filter((f) => f.season === season).map((f) => [f.playerId, f]));

  const byPosition = new Map<string, DraftPick[]>();
  for (const pick of seasonPicks) {
    const finish = finishByPlayer.get(pick.playerId);
    const position = finish?.position ?? players[pick.playerId]?.position;
    if (!position) continue;
    const bucket = byPosition.get(position) ?? [];
    bucket.push(pick);
    byPosition.set(position, bucket);
  }

  const out: PickDetail[] = [];
  for (const [position, bucket] of byPosition) {
    const sorted = [...bucket].sort((a, b) => a.pickNo - b.pickNo);
    const poolSize = sorted.length;
    sorted.forEach((pick, i) => {
      const f = finishByPlayer.get(pick.playerId);
      const finish: PickFinish | undefined = f
        ? { finishRank: f.positionRank, points: f.points, gamesPlayed: f.gamesPlayed, pointsPerGame: f.gamesPlayed > 0 ? round2(f.points / f.gamesPlayed) : 0, rawStats: f.rawStats }
        : undefined;
      out.push({ season, pickNo: pick.pickNo, round: pick.round, managerId: pick.managerId, playerId: pick.playerId, position, draftRank: i + 1, poolSize, finish });
    });
  }
  return out;
}

export type UngradedReason = "no-finish-data" | "insufficient-games-played";

export type PickGrade =
  | (Omit<PickDetail, "finish"> & { finish: PickFinish; graded: true; score: number; grade: Grade })
  | (PickDetail & { graded: false; reason: UngradedReason });

export function gradeForScore(score: number, config: DraftGradeConfig = DEFAULT_DRAFT_GRADE_CONFIG): Grade {
  for (const bp of config.gradeBreakpoints) {
    if (score >= bp.min) return bp.grade;
  }
  return config.gradeBreakpoints[config.gradeBreakpoints.length - 1]!.grade;
}

function isGradedPosition(position: string, config: DraftGradeConfig): position is GradedPosition {
  return (config.positions as readonly string[]).includes(position);
}

/** Points scored by whoever finished at exactly this position+rank that season, falling back to the lowest-ranked finisher, or 0. */
function pointsAtRank(rankedByRankAsc: PlayerSeasonFinish[], rank: number): number {
  if (rankedByRankAsc.length === 0) return 0;
  return (rankedByRankAsc.find((f) => f.positionRank === rank) ?? rankedByRankAsc[rankedByRankAsc.length - 1]!).points;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

/**
 * Picks at config.positions, each graded or marked ungraded with a reason.
 * Ungraded picks (no finish data, or too few games played) still appear in
 * the output — unlike the draft-slot bucketing above, they just carry no
 * score — so the UI can render an explicit "N/A" instead of silently
 * omitting them.
 */
export function gradedPicksForSeason(
  picks: DraftPick[],
  finishes: PlayerSeasonFinish[],
  players: Record<string, PlayerInfo>,
  season: number,
  config: DraftGradeConfig = DEFAULT_DRAFT_GRADE_CONFIG,
): PickGrade[] {
  const details = pickDetailsForSeason(picks, finishes, players, season).filter((d) => isGradedPosition(d.position, config));
  const seasonFinishes = finishes.filter((f) => f.season === season);
  const fullSeasonGames = seasonFinishes.reduce((max, f) => Math.max(max, f.gamesPlayed), 0);

  const rankedByPosition = new Map<string, PlayerSeasonFinish[]>();
  for (const f of seasonFinishes) rankedByPosition.set(f.position, [...(rankedByPosition.get(f.position) ?? []), f]);
  for (const ranked of rankedByPosition.values()) ranked.sort((a, b) => a.positionRank - b.positionRank);

  // The spread of outcomes actually seen in this draft at each position — a stable yardstick for how
  // big a swing a surplus is. Normalizing against the position's single #1 scorer instead would
  // self-shrink a pick's own score whenever the picked player IS that #1 scorer.
  const pointsByPosition = new Map<string, number[]>();
  for (const d of details) {
    if (d.finish) pointsByPosition.set(d.position, [...(pointsByPosition.get(d.position) ?? []), d.finish.points]);
  }
  const spreadByPosition = new Map([...pointsByPosition].map(([position, pts]) => [position, stdDev(pts)]));

  return details.map((detail): PickGrade => {
    if (!detail.finish) return { ...detail, graded: false, reason: "no-finish-data" };
    if (detail.finish.gamesPlayed < fullSeasonGames * config.minGamesPlayedFraction) {
      return { ...detail, graded: false, reason: "insufficient-games-played" };
    }
    const ranked = rankedByPosition.get(detail.position) ?? [];
    const normalizedRankDelta = clamp((detail.draftRank - detail.finish.finishRank) / detail.poolSize, -1, 1);
    const replacementPoints = pointsAtRank(ranked, detail.draftRank);
    const spread = spreadByPosition.get(detail.position) ?? 0;
    const normalizedPointsDelta = spread > 0 ? clamp((detail.finish.points - replacementPoints) / spread, -1, 1) : 0;
    const score = round2(config.rankDeltaWeight * normalizedRankDelta + config.pointsDeltaWeight * normalizedPointsDelta);
    return { ...detail, finish: detail.finish, graded: true, score, grade: gradeForScore(score, config) };
  });
}

export interface ManagerSeasonGrade {
  managerId: string;
  season: number;
  /** Graded picks only. */
  pickCount: number;
  averageScore: number;
  grade: Grade;
  /** Both graded and ungraded (N/A) picks, for display. */
  picks: PickGrade[];
}

export interface ManagerCareerGrade {
  managerId: string;
  pickCount: number;
  averageScore: number;
  grade: Grade;
}

export interface DraftGradeResults {
  /** Only managers with at least one graded pick that season. */
  bySeason: Record<number, ManagerSeasonGrade[]>;
  /** Flat-pooled across every graded pick ever made, not an average of season averages. */
  career: ManagerCareerGrade[];
}

function weightedSummary(picks: PickGrade[], config: DraftGradeConfig): { pickCount: number; averageScore: number; grade: Grade } {
  const graded = picks.filter((p): p is Extract<PickGrade, { graded: true }> => p.graded);
  if (graded.length === 0) return { pickCount: 0, averageScore: 0, grade: gradeForScore(0, config) };
  let weightedSum = 0;
  let weightTotal = 0;
  for (const p of graded) {
    const w = config.roundWeight(p.round);
    weightedSum += p.score * w;
    weightTotal += w;
  }
  const averageScore = round2(weightTotal > 0 ? weightedSum / weightTotal : 0);
  return { pickCount: graded.length, averageScore, grade: gradeForScore(averageScore, config) };
}

function byManagerId(picks: PickGrade[]): Map<string, PickGrade[]> {
  const out = new Map<string, PickGrade[]>();
  for (const pick of picks) out.set(pick.managerId, [...(out.get(pick.managerId) ?? []), pick]);
  return out;
}

export function computeDraftGrades(league: LeagueHistory, config: DraftGradeConfig = DEFAULT_DRAFT_GRADE_CONFIG): DraftGradeResults {
  const seasons = [...new Set(league.draftPicks.map((p) => p.season))].sort((a, b) => a - b);
  const bySeason: Record<number, ManagerSeasonGrade[]> = {};
  const careerPicks: PickGrade[] = [];

  for (const season of seasons) {
    const picks = gradedPicksForSeason(league.draftPicks, league.playerSeasonFinishes, league.players, season, config);
    careerPicks.push(...picks);
    const rows = [...byManagerId(picks)]
      .map(([managerId, managerPicks]) => {
        const sortedPicks = [...managerPicks].sort((a, b) => a.pickNo - b.pickNo);
        return { managerId, season, picks: sortedPicks, ...weightedSummary(sortedPicks, config) };
      })
      .filter((row) => row.pickCount > 0)
      .sort((a, b) => b.averageScore - a.averageScore || a.managerId.localeCompare(b.managerId));
    if (rows.length) bySeason[season] = rows;
  }

  const career = [...byManagerId(careerPicks)]
    .map(([managerId, managerPicks]) => ({ managerId, ...weightedSummary(managerPicks, config) }))
    .filter((row) => row.pickCount > 0)
    .sort((a, b) => b.averageScore - a.averageScore || a.managerId.localeCompare(b.managerId));

  return { bySeason, career };
}

export const draftGrades = defineStat({
  id: "draftGrades",
  title: "Draft grades",
  description: "Grades every draft pick by comparing where a player was taken at his position to where he actually finished that season, weighted toward points produced and early-round picks.",
  compute(ctx): DraftGradeResults {
    return computeDraftGrades(ctx.league);
  },
});
