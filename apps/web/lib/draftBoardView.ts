/** Plain, serializable lookup for one drafted player, shown in a modal from the draft board — no grade, just facts. */
export interface DraftBoardPickView {
  playerId: string;
  playerName: string;
  position: string;
  /** e.g. "WR28" — the 28th player at this position taken that season. */
  draftRankText: string;
  /** e.g. "WR5", or "N/A" if there's no season finish data (including: the season is still in progress). */
  finishRankText: string;
  /** e.g. "14.20", or "N/A". */
  pointsPerGameText: string;
}
