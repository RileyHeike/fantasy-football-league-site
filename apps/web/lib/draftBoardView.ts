import type { Grade } from "@league/core";
import type { StatLineEntry } from "./statLine";

/** Plain, serializable season summary for one drafted player, shown in a modal from the draft board. */
export interface DraftBoardPickView {
  playerId: string;
  playerName: string;
  position: string;
  nflTeam?: string;
  managerId: string;
  managerName: string;
  colorIndex: number;
  /** e.g. "WR28" — the 28th player at this position taken that season. */
  draftRankText: string;
  /** e.g. "WR5", or "N/A" if there's no season finish data (including: the season is still in progress). */
  finishRankText: string;
  /** e.g. "14.20", or "N/A". */
  pointsPerGameText: string;
  points?: number;
  gamesPlayed?: number;
  statLine: StatLineEntry[];
  /** Present only for a graded pick (QB/RB/WR/TE that cleared the games-played gate). */
  grade?: { grade: Grade; gradeColor: string };
  /** Present for an ungraded pick that's otherwise in the graded-position universe (not K/DEF). */
  ungraded?: { reasonLabel: string };
}
