/**
 * Plain, serializable view of a game. Built server-side (see lib/data.ts's
 * buildMatchup) and handed to client components as props, so modal content
 * never needs to import server-only data access at click-time.
 */
export interface MatchupPlayerLine {
  playerId: string;
  name: string;
  position?: string;
  points: number;
}

export interface MatchupSide {
  managerId: string;
  managerName: string;
  colorIndex: number;
  teamName: string;
  points: number;
  won: boolean;
  starters: MatchupPlayerLine[];
  bench: MatchupPlayerLine[];
}

export interface MatchupData {
  id: string;
  label: string;
  final: boolean;
  home: MatchupSide;
  away: MatchupSide;
}
