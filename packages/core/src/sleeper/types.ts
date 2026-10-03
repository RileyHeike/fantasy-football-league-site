/**
 * Raw response shapes from the public Sleeper API (https://docs.sleeper.app/).
 * Only fields we use are typed strictly; everything else is kept loosely so a
 * new Sleeper field never breaks the importer. Raw responses are stored as-is
 * ("store raw, derive later"), so these types describe, never reshape.
 */

export type SleeperId = string;

export interface SleeperLeague {
  league_id: SleeperId;
  previous_league_id: SleeperId | null;
  name: string;
  season: string;
  status: "pre_draft" | "drafting" | "in_season" | "complete" | string;
  total_rosters: number;
  draft_id: SleeperId | null;
  avatar: string | null;
  settings: {
    playoff_week_start?: number;
    playoff_teams?: number;
    last_scored_leg?: number;
    leg?: number;
    [key: string]: unknown;
  };
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  [key: string]: unknown;
}

export interface SleeperUser {
  user_id: SleeperId;
  username?: string;
  display_name: string;
  avatar: string | null;
  is_owner?: boolean;
  metadata?: { team_name?: string; [key: string]: unknown };
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: SleeperId | null;
  co_owners?: SleeperId[] | null;
  players: string[] | null;
  starters: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
    [key: string]: unknown;
  };
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  custom_points?: number | null;
  starters: string[];
  players: string[];
  /** Unofficial but present in practice: per-player points. Treat as optional. */
  players_points?: Record<string, number>;
  starters_points?: number[];
}

export interface SleeperBracketMatch {
  r: number;
  m: number;
  t1: number | null;
  t2: number | null;
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
  w: number | null;
  l: number | null;
  /** Placement game: p=1 is the final, p=3 third place, etc. */
  p?: number;
}

export interface SleeperTransaction {
  transaction_id: SleeperId;
  type: "trade" | "free_agent" | "waiver" | "commissioner" | string;
  status: string;
  leg: number;
  created: number;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: unknown[];
  waiver_budget: { sender: number; receiver: number; amount: number }[];
  settings?: { waiver_bid?: number } | null;
}

export interface SleeperDraft {
  draft_id: SleeperId;
  season: string;
  type: string;
  status: string;
  start_time: number | null;
  settings: { rounds?: number; teams?: number; [key: string]: unknown };
  slot_to_roster_id?: Record<string, number> | null;
}

export interface SleeperDraftPick {
  player_id: string;
  picked_by: SleeperId;
  roster_id: string | number;
  round: number;
  draft_slot: number;
  pick_no: number;
  metadata: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
    [key: string]: unknown;
  };
}

export interface SleeperNflState {
  season: string;
  season_type: "pre" | "regular" | "post" | string;
  week: number;
  display_week?: number;
  league_season?: string;
}

export interface SleeperPlayer {
  player_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  team?: string | null;
}

/**
 * One player's stat line from Sleeper's undocumented stats API
 * (api.sleeper.com/stats/nfl/..., not part of the documented v1 API).
 * `stats` holds raw per-category counts (rec, rush_yd, fgm_yds, ...); turning
 * those into fantasy points for a specific league is scorePoints()'s job —
 * never trust the API's own pts_std/half_ppr/ppr fields, they assume a fixed
 * scoring format that may not match a given league's actual settings.
 */
export interface SleeperPlayerStatLine {
  player_id: SleeperId;
  stats: Record<string, number>;
  player?: { position?: string | null; [key: string]: unknown };
}
