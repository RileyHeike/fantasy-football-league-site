import {
  buildSnapshot,
  importHistory,
  SleeperClient,
  type LeagueConfig,
  type LeagueSnapshot,
  type RawSeasonStore,
  type SleeperPlayer,
  type SnapshotStore,
} from "@league/core";

export interface SyncDeps {
  client: SleeperClient;
  raw: RawSeasonStore;
  snapshots: SnapshotStore;
  config: LeagueConfig;
  /** League ID of the newest season; defaults to config.leagueId. */
  leagueId?: string;
  players?: Record<string, SleeperPlayer>;
  log?: (m: string) => void;
}

/**
 * One sync run, identical locally and in Lambda:
 * read NFL state -> import new/unfinished seasons -> store raw -> build snapshot.
 */
export async function runSync(deps: SyncDeps): Promise<LeagueSnapshot> {
  const log = deps.log ?? console.log;
  const state = await deps.client.nflState();
  const existing = await deps.raw.loadAll();
  const seasons = await importHistory(deps.client, deps.leagueId ?? deps.config.leagueId, {
    existing,
    currentWeek: state.week,
    log,
  });
  const cachedIds = new Set(existing.filter((s) => s.league.status === "complete").map((s) => s.league.league_id));
  for (const s of seasons) if (!cachedIds.has(s.league.league_id)) await deps.raw.save(s);

  const snapshot = buildSnapshot(
    seasons,
    { season: Number(state.season), week: state.week },
    { config: deps.config, players: deps.players },
  );
  await deps.snapshots.save(snapshot);
  log(
    `snapshot: ${snapshot.league.seasons.length} seasons, ${snapshot.league.games.length} games, ` +
      `${snapshot.league.managers.length} managers`,
  );
  return snapshot;
}
