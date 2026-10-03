import type { RawSeason } from "../sleeper/history";
import type { SleeperPlayerStatLine } from "../sleeper/types";
import type { LeagueSnapshot } from "../snapshot";

/**
 * Storage is behind interfaces so the same sync code runs locally (files) and
 * on AWS (S3 for raw seasons and snapshots, DynamoDB for per-entity items).
 */
export interface RawSeasonStore {
  loadAll(): Promise<RawSeason[]>;
  save(season: RawSeason): Promise<void>;
}

export interface SnapshotStore {
  load(): Promise<LeagueSnapshot | null>;
  save(snapshot: LeagueSnapshot): Promise<void>;
}

/** Season-total stat lines per position, keyed by season year. Completed seasons are cached, never re-fetched. */
export interface PlayerStatsStore {
  loadAll(): Promise<Record<number, SleeperPlayerStatLine[]>>;
  save(season: number, lines: SleeperPlayerStatLine[]): Promise<void>;
}

/** Weekly stat lines, keyed by "<playerId>-<season>". Only populated for players who were ever traded/added. */
export interface PlayerWeeklyStore {
  loadAll(): Promise<Record<string, Record<string, SleeperPlayerStatLine>>>;
  save(playerId: string, season: number, weeks: Record<string, SleeperPlayerStatLine>): Promise<void>;
}
