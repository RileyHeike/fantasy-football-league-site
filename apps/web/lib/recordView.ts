import type { MatchupData } from "./matchup";

/** Plain view of one row in a record's top-10 leaderboard, built server-side. */
export interface RecordRowView {
  rank: number;
  managerId: string;
  managerName: string;
  colorIndex: number;
  valueText: string;
  whenText: string;
  /** Present for "game" rows (that game) and "season" rows (the manager's final game that season). */
  matchup?: MatchupData;
}

export interface RecordCardView {
  id: string;
  label: string;
  category: "game" | "season" | "streak";
  valueText: string;
  whenText: string;
  managerName: string;
  colorIndex: number;
  rows: RecordRowView[];
}
