import { StatContext } from "./context";
import { advanced } from "./advanced";
import { draftGrades } from "./draftGrades";
import { headToHead } from "./headToHead";
import { records } from "./records";
import { standings } from "./standings";
import { trophies } from "./trophies";
import type { LeagueHistory } from "../model/types";

/**
 * The stat registry. To add a stat: write a module with defineStat() and add
 * it here. Its result appears in the snapshot under its id, fully typed.
 */
export const STAT_MODULES = { standings, headToHead, records, advanced, trophies, draftGrades } as const;

export type StatResults = {
  [K in keyof typeof STAT_MODULES]: ReturnType<(typeof STAT_MODULES)[K]["compute"]>;
};

export function computeAll(league: LeagueHistory): StatResults {
  const ctx = new StatContext(league);
  const out = {} as Record<string, unknown>;
  for (const [id, mod] of Object.entries(STAT_MODULES)) out[id] = mod.compute(ctx);
  return out as StatResults;
}

export { StatContext, defineStat } from "./context";
export type { StatModule, Perspective } from "./context";
export type { RecordLine, SeasonStanding, CareerLine } from "./standings";
export type { HeadToHeadLine } from "./headToHead";
export type { LeagueRecord } from "./records";
export type { AdvancedLine } from "./advanced";
export type { TrophyCase } from "./trophies";
export { computeDraftGrades, gradedPicksForSeason, gradeForScore } from "./draftGrades";
export type { DraftGradeResults, ManagerSeasonGrade, ManagerCareerGrade, GradedPick } from "./draftGrades";
export { DEFAULT_DRAFT_GRADE_CONFIG } from "./draftGradeConfig";
export type { DraftGradeConfig, Grade, GradedPosition } from "./draftGradeConfig";
