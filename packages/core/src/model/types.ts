/**
 * The normalized league model. Every stat, page and export reads this shape,
 * never raw Sleeper responses. Managers are permanent people; teams are a
 * manager's entry in one season.
 */

export interface Manager {
  /** Stable slug, e.g. "riley". Used in URLs. */
  id: string;
  name: string;
  avatar: string | null;
  /** Sleeper user_ids that belong to this person (handles account changes). */
  userIds: string[];
  /** Index into the manager color palette, stable across builds. */
  colorIndex: number;
  /** Team names used over the years, newest last. */
  teamNames: string[];
  firstSeason: number;
  lastSeason: number;
}

export interface SeasonTeam {
  managerId: string;
  rosterId: number;
  teamName: string;
}

export type SeasonStatus = "pre_draft" | "drafting" | "in_season" | "complete";

export interface Season {
  year: number;
  leagueId: string;
  name: string;
  status: SeasonStatus | string;
  /** Weeks 1..regularSeasonWeeks are regular season. */
  regularSeasonWeeks: number;
  playoffTeams: number;
  lastWeek: number;
  teams: SeasonTeam[];
  placements: SeasonPlacements;
}

export interface SeasonPlacements {
  champion?: string;
  runnerUp?: string;
  third?: string;
  /** "Toilet bowl" loser, per league config. */
  last?: string;
}

export type GameKind = "regular" | "playoff" | "consolation";

export interface GameSide {
  managerId: string;
  points: number;
  /** Starters with points, when Sleeper provides per-player scoring. */
  starters?: { playerId: string; points: number }[];
  /** Bench players with points, when available. */
  bench?: { playerId: string; points: number }[];
}

export interface Game {
  id: string;
  season: number;
  week: number;
  kind: GameKind;
  /** Placement this game decides (1 = final, 3 = third place), if any. */
  placement?: number;
  home: GameSide;
  away: GameSide;
  /** null when tied or not yet played. */
  winnerId: string | null;
  final: boolean;
}

export interface Transaction {
  id: string;
  season: number;
  week: number;
  type: "trade" | "waiver" | "free_agent" | string;
  created: number;
  managerIds: string[];
  adds: { playerId: string; managerId: string }[];
  drops: { playerId: string; managerId: string }[];
  faabBid?: number;
}

export interface DraftPick {
  season: number;
  round: number;
  pickNo: number;
  managerId: string;
  playerId: string;
}

export interface PlayerInfo {
  name: string;
  position?: string;
  team?: string | null;
}

export interface LeagueHistory {
  leagueName: string;
  managers: Manager[];
  seasons: Season[];
  games: Game[];
  transactions: Transaction[];
  draftPicks: DraftPick[];
  players: Record<string, PlayerInfo>;
}

/**
 * Hand-written league config (content/league.config.json). Covers what no
 * API knows: who is who across accounts, trophy names, how last place works.
 */
export interface LeagueConfig {
  leagueId: string;
  name?: string;
  /** Optional manual identity map; unknown user_ids become their own manager. */
  managers?: {
    id: string;
    name: string;
    userIds: string[];
  }[];
  trophies?: {
    champion?: string;
    last?: string;
  };
  /**
   * How the last-place finisher is decided:
   * - "regularSeason": worst regular-season record (default)
   * - "consolationFinalLoser": loser of the losers-bracket p=1 game
   * - "consolationFinalWinner": winner of it (toilet bowl, losers advance)
   */
  lastPlaceRule?: "regularSeason" | "consolationFinalLoser" | "consolationFinalWinner";
}
