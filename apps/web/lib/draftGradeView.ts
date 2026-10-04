interface DraftGradePickRowBase {
  playerId: string;
  playerName: string;
  position: string;
  round: number;
  pickNo: number;
  /** e.g. "WR28" — the 28th player at this position taken that season. */
  draftRankText: string;
  /** e.g. "WR5", or "N/A" if the player has no season finish data at all. */
  finishRankText: string;
}

/** Plain view of one pick, built server-side for client-rendered modals — graded, or N/A with why. */
export type DraftGradePickRowView =
  | (DraftGradePickRowBase & { graded: true; grade: string; gradeColor: string })
  | (DraftGradePickRowBase & { graded: false; reasonLabel: string });

export interface DraftGradeSeasonRowView {
  managerId: string;
  managerName: string;
  colorIndex: number;
  season: number;
  pickCount: number;
  grade: string;
  gradeColor: string;
  picks: DraftGradePickRowView[];
}

export interface DraftGradeCareerRowView {
  managerId: string;
  managerName: string;
  colorIndex: number;
  pickCount: number;
  grade: string;
  gradeColor: string;
  /** This manager's own season-by-season breakdown, newest first. */
  seasons: DraftGradeSeasonRowView[];
}

export interface DraftGradeLeaderboardView {
  career: DraftGradeCareerRowView[];
  seasons: { season: number; rows: DraftGradeSeasonRowView[] }[];
}
