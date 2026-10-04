/**
 * Tunable knobs for draft grading, kept apart from the computation logic in
 * draftGrades.ts so trial-and-error tuning is a config edit, not a refactor.
 */

export type Grade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D" | "F";

export const GRADED_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
export type GradedPosition = (typeof GRADED_POSITIONS)[number];

export interface DraftGradeConfig {
  /** Positions graded at all. K/DEF are deliberately excluded. */
  positions: readonly GradedPosition[];
  /** Breakpoints on the normalized [-1, 1] score. Checked highest `min` first. */
  gradeBreakpoints: { min: number; grade: Grade }[];
  /** Blend weights for the two scoring signals. Should sum to 1 so the blended score stays in [-1, 1]. */
  rankDeltaWeight: number;
  pointsDeltaWeight: number;
  /** Applied to both season and career averages — how much an early-round pick outweighs a late-round one. */
  roundWeight: (round: number) => number;
  /** A pick is graded only if its player played at least this fraction of that season's max games played. */
  minGamesPlayedFraction: number;
}

export const DEFAULT_DRAFT_GRADE_CONFIG: DraftGradeConfig = {
  positions: GRADED_POSITIONS,
  gradeBreakpoints: [
    { min: 0.5, grade: "A+" },
    { min: 0.35, grade: "A" },
    { min: 0.22, grade: "A-" },
    { min: 0.12, grade: "B+" },
    { min: 0.04, grade: "B" },
    { min: -0.04, grade: "B-" },
    { min: -0.12, grade: "C+" },
    { min: -0.22, grade: "C" },
    { min: -0.35, grade: "C-" },
    { min: -0.5, grade: "D" },
    { min: -Infinity, grade: "F" },
  ],
  rankDeltaWeight: 0.25,
  pointsDeltaWeight: 0.75,
  roundWeight: (round) => 1 / round,
  minGamesPlayedFraction: 0.5,
};
