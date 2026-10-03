import {
  buildSnapshot,
  importHistory,
  FANTASY_POSITIONS,
  SleeperClient,
  SleeperStatsClient,
  type LeagueConfig,
  type LeagueSnapshot,
  type PlayerStatsStore,
  type PlayerWeeklyStore,
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
  /**
   * Player-finish pipeline (draft/trade/waiver grades). Omitted entirely for
   * the offline fixture demo, which has no network and no real transactions
   * to grade.
   */
  statsClient?: SleeperStatsClient;
  playerStats?: PlayerStatsStore;
  playerWeekly?: PlayerWeeklyStore;
  log?: (m: string) => void;
}

const TRANSACTION_TYPES_NEEDING_FINISH = new Set(["trade", "waiver", "free_agent"]);

/**
 * One sync run, identical locally and in Lambda:
 * read NFL state -> import new/unfinished seasons -> store raw -> fetch any
 * missing player-finish data -> build snapshot.
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

  let playerSeasonStats: Awaited<ReturnType<PlayerStatsStore["loadAll"]>> | undefined;
  let playerWeeklyStats: Awaited<ReturnType<PlayerWeeklyStore["loadAll"]>> | undefined;

  if (deps.statsClient && deps.playerStats && deps.playerWeekly) {
    playerSeasonStats = await deps.playerStats.loadAll();
    for (const s of seasons) {
      const year = Number(s.league.season);
      if (s.league.status !== "complete" || playerSeasonStats[year]) continue;
      // Sequential on purpose, same as the main importer: stay well under rate guidance,
      // doubly so for an undocumented endpoint with no published limits.
      const lines = [];
      for (const pos of FANTASY_POSITIONS) lines.push(...(await deps.statsClient!.seasonStatsByPosition(year, pos)));
      await deps.playerStats.save(year, lines);
      playerSeasonStats[year] = lines;
      log(`player stats: fetched season ${year} (${lines.length} players)`);
    }

    playerWeeklyStats = await deps.playerWeekly.loadAll();
    const relevantByYear = new Map<number, Set<string>>();
    for (const s of seasons) {
      const year = Number(s.league.season);
      for (const tx of s.transactions) {
        if (tx.status !== "complete" || !TRANSACTION_TYPES_NEEDING_FINISH.has(tx.type)) continue;
        const ids = relevantByYear.get(year) ?? new Set<string>();
        for (const rec of [tx.adds, tx.drops]) for (const playerId of Object.keys(rec ?? {})) ids.add(playerId);
        relevantByYear.set(year, ids);
      }
    }
    let fetchedWeekly = 0;
    for (const s of seasons) {
      const year = Number(s.league.season);
      const playerIds = relevantByYear.get(year);
      if (!playerIds) continue;
      for (const playerId of playerIds) {
        const key = `${playerId}-${year}`;
        if (s.league.status === "complete" && playerWeeklyStats[key]) continue;
        const weeks = await deps.statsClient.playerWeeklyStats(playerId, year);
        await deps.playerWeekly.save(playerId, year, weeks);
        playerWeeklyStats[key] = weeks;
        fetchedWeekly++;
      }
    }
    if (fetchedWeekly > 0) log(`player weekly stats: fetched ${fetchedWeekly} player-seasons`);
  }

  const snapshot = buildSnapshot(
    seasons,
    { season: Number(state.season), week: state.week },
    { config: deps.config, players: deps.players, playerSeasonStats, playerWeeklyStats },
  );
  await deps.snapshots.save(snapshot);
  log(
    `snapshot: ${snapshot.league.seasons.length} seasons, ${snapshot.league.games.length} games, ` +
      `${snapshot.league.managers.length} managers, ${snapshot.league.playerSeasonFinishes.length} player finishes`,
  );
  return snapshot;
}
