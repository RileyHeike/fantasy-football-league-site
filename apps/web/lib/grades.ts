import type { Grade } from "@league/core";

/**
 * Letter-grade accent colors: a single blue-to-plum intensity ramp, in the
 * spirit of positions.ts's muted hex tints. Deliberately not --win/--loss (a
 * grade isn't a game result) or --gold (reserved for champions/records).
 */
export const GRADE_COLORS: Record<Grade, string> = {
  "A+": "#8fb3e8",
  A: "#85a8dd",
  "A-": "#7b9dd1",
  "B+": "#7593c4",
  B: "#7089b3",
  "B-": "#6c7fa0",
  "C+": "#6c7696",
  C: "#6c6f89",
  "C-": "#6c687c",
  D: "#6c5f6e",
  F: "#6c5660",
};

export const gradeColor = (grade: Grade): string => GRADE_COLORS[grade];
