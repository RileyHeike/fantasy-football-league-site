import { round2 } from "../model/normalize";
import { defineStat } from "./context";
import type { DraftPick, LeagueHistory, PlayerInfo, PlayerSeasonFinish } from "../model/types";
import { DEFAULT_DRAFT_GRADE_CONFIG, type DraftGradeConfig, type Grade, type GradedPosition } from "./draftGradeConfig";

export interface GradedPick {
  season: number;
  pickNo: number;
  round: number;
  managerId: string;
  playerId: string;
  position: GradedPosition;
  /** 1 = first player at this position taken that season. */
  draftRank: number;
  /** PlayerSeasonFinish.positionRank: 1 = the best fantasy season at this position that year. */
  finishRank: number;
  /** Picks at this position that season — the normalization denominator. */
  poolSize: number;
  /** clamp((draftRank - finishRank) / poolSize, -1, 1). Positive = outperformed draft slot. */
  score: number;
  grade: Grade;
}

export interface ManagerSeasonGrade {
  managerId: string;
  season: number;
  pickCount: number;
  averageScore: number;
  grade: Grade;
  picks: GradedPick[];
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

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function isGradedPosition(position: string | undefined, config: DraftGradeConfig): position is GradedPosition {
  return !!position && (config.positions as readonly string[]).includes(position);
}

export function gradeForScore(score: number, config: DraftGradeConfig = DEFAULT_DRAFT_GRADE_CONFIG): Grade {
  for (const bp of config.gradeBreakpoints) {
    if (score >= bp.min) return bp.grade;
  }
  return config.gradeBreakpoints[config.gradeBreakpoints.length - 1]!.grade;
}

/**
 * Every pick at a position counts toward that position's draft order for the
 * season, even a pick that ends up ungraded (no finish data, e.g. a bust) —
 * it still occupied a slot that shifts every later pick's rank. So bucketing
 * happens first over every pick, and only graded picks are emitted after.
 */
export function gradedPicksForSeason(
  picks: DraftPick[],
  finishes: PlayerSeasonFinish[],
  players: Record<string, PlayerInfo>,
  season: number,
  config: DraftGradeConfig = DEFAULT_DRAFT_GRADE_CONFIG,
): GradedPick[] {
  const seasonPicks = picks.filter((p) => p.season === season);
  const finishByPlayer = new Map(finishes.filter((f) => f.season === season).map((f) => [f.playerId, f]));

  const byPosition = new Map<GradedPosition, DraftPick[]>();
  for (const pick of seasonPicks) {
    const finish = finishByPlayer.get(pick.playerId);
    const position = finish?.position ?? players[pick.playerId]?.position;
    if (!isGradedPosition(position, config)) continue;
    const bucket = byPosition.get(position) ?? [];
    bucket.push(pick);
    byPosition.set(position, bucket);
  }

  const out: GradedPick[] = [];
  for (const [position, bucket] of byPosition) {
    const sorted = [...bucket].sort((a, b) => a.pickNo - b.pickNo);
    const poolSize = sorted.length;
    sorted.forEach((pick, i) => {
      const finish = finishByPlayer.get(pick.playerId);
      if (!finish) return;
      const draftRank = i + 1;
      const finishRank = finish.positionRank;
      const score = clamp((draftRank - finishRank) / poolSize, -1, 1);
      out.push({
        season,
        pickNo: pick.pickNo,
        round: pick.round,
        managerId: pick.managerId,
        playerId: pick.playerId,
        position,
        draftRank,
        finishRank,
        poolSize,
        score: round2(score),
        grade: gradeForScore(score, config),
      });
    });
  }
  return out;
}

function summarize(picks: GradedPick[], config: DraftGradeConfig): { pickCount: number; averageScore: number; grade: Grade } {
  const averageScore = round2(picks.reduce((sum, p) => sum + p.score, 0) / picks.length);
  return { pickCount: picks.length, averageScore, grade: gradeForScore(averageScore, config) };
}

function byManagerId(picks: GradedPick[]): Map<string, GradedPick[]> {
  const out = new Map<string, GradedPick[]>();
  for (const pick of picks) out.set(pick.managerId, [...(out.get(pick.managerId) ?? []), pick]);
  return out;
}

export function computeDraftGrades(league: LeagueHistory, config: DraftGradeConfig = DEFAULT_DRAFT_GRADE_CONFIG): DraftGradeResults {
  const seasons = [...new Set(league.draftPicks.map((p) => p.season))].sort((a, b) => a - b);
  const bySeason: Record<number, ManagerSeasonGrade[]> = {};
  const careerPicks: GradedPick[] = [];

  for (const season of seasons) {
    const graded = gradedPicksForSeason(league.draftPicks, league.playerSeasonFinishes, league.players, season, config);
    careerPicks.push(...graded);
    const rows = [...byManagerId(graded)]
      .map(([managerId, picks]) => ({ managerId, season, picks, ...summarize(picks, config) }))
      .sort((a, b) => b.averageScore - a.averageScore || a.managerId.localeCompare(b.managerId));
    if (rows.length) bySeason[season] = rows;
  }

  const career = [...byManagerId(careerPicks)]
    .map(([managerId, picks]) => ({ managerId, ...summarize(picks, config) }))
    .sort((a, b) => b.averageScore - a.averageScore || a.managerId.localeCompare(b.managerId));

  return { bySeason, career };
}

export const draftGrades = defineStat({
  id: "draftGrades",
  title: "Draft grades",
  description: "Grades every draft pick by comparing where a player was taken at his position to where he actually finished that season.",
  compute(ctx): DraftGradeResults {
    return computeDraftGrades(ctx.league);
  },
});
