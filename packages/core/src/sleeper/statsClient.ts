import { HttpTransport, type SleeperTransport } from "./client";
import type { SleeperPlayerStatLine } from "./types";

export const STATS_BASE_URL = "https://api.sleeper.com";

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

/**
 * Adapter for Sleeper's undocumented stats API — a different host
 * (api.sleeper.com) than the documented, stable v1 API the rest of this
 * package talks to, with no stability guarantee from Sleeper. Deliberately
 * isolated to this one file: if it ever breaks or changes shape, only this
 * adapter needs to change, not the importer or normalizer.
 */
export class SleeperStatsClient {
  constructor(private readonly t: SleeperTransport = new HttpTransport({ baseUrl: STATS_BASE_URL })) {}

  /** Every player at one position, season totals, for a completed season. */
  async seasonStatsByPosition(season: number, position: (typeof POSITIONS)[number]): Promise<SleeperPlayerStatLine[]> {
    const params = new URLSearchParams({ season_type: "regular" });
    params.append("position[]", position);
    return this.t.get<SleeperPlayerStatLine[]>(`/stats/nfl/${season}?${params}`);
  }

  /** One player's week-by-week stats for a season, keyed by week number. */
  playerWeeklyStats(playerId: string, season: number): Promise<Record<string, SleeperPlayerStatLine>> {
    const params = new URLSearchParams({ season: String(season), season_type: "regular", grouping: "week" });
    return this.t.get<Record<string, SleeperPlayerStatLine>>(`/stats/nfl/player/${playerId}?${params}`);
  }
}

export const FANTASY_POSITIONS = POSITIONS;
