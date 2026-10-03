import type { RawSeason } from "../sleeper/history";
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
