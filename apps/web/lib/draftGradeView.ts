/** Plain view of one graded pick, built server-side for client-rendered modals. */
export interface DraftGradePickRowView {
  playerId: string;
  playerName: string;
  position: string;
  round: number;
  pickNo: number;
  /** e.g. "WR28" — the 28th player at this position taken that season. */
  draftRankText: string;
  /** e.g. "WR5" — how the player actually finished that season at the position. */
  finishRankText: string;
  grade: string;
  gradeColor: string;
}

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
