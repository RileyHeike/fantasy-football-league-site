import type { SleeperClient } from "./client";
import type {
  SleeperBracketMatch,
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperMatchup,
  SleeperRoster,
  SleeperTransaction,
  SleeperUser,
} from "./types";

/** Everything Sleeper knows about one season, untouched. */
export interface RawSeason {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  /** matchups[i] = week i+1 */
  matchups: SleeperMatchup[][];
  winnersBracket: SleeperBracketMatch[];
  losersBracket: SleeperBracketMatch[];
  transactions: SleeperTransaction[];
  drafts: { draft: SleeperDraft; picks: SleeperDraftPick[] }[];
  fetchedAt: string;
}

export interface ImportOptions {
  /** Seasons already stored. Completed ones are reused, never re-fetched. */
  existing?: RawSeason[];
  /** Current NFL week; caps how far an in-progress season is fetched. */
  currentWeek?: number;
  log?: (msg: string) => void;
}

/** Last week a season can contain games (end of playoffs). */
export function lastWeekOf(league: SleeperLeague): number {
  const start = league.settings.playoff_week_start ?? 15;
  const teams = league.settings.playoff_teams ?? 6;
  const rounds = Math.max(1, Math.ceil(Math.log2(teams)));
  return start + rounds - 1;
}

/**
 * Walk from the current league back through previous_league_id, returning
 * seasons oldest first. Completed seasons found in `existing` are reused.
 */
export async function importHistory(
  client: SleeperClient,
  currentLeagueId: string,
  opts: ImportOptions = {},
): Promise<RawSeason[]> {
  const log = opts.log ?? (() => {});
  const cache = new Map(
    (opts.existing ?? [])
      .filter((s) => s.league.status === "complete")
      .map((s) => [s.league.league_id, s]),
  );

  const seasons: RawSeason[] = [];
  const seen = new Set<string>();
  let id: string | null = currentLeagueId;

  while (id && id !== "0" && !seen.has(id)) {
    seen.add(id);
    const cached = cache.get(id);
    if (cached) {
      log(`season ${cached.league.season}: cached`);
      seasons.push(cached);
      id = cached.league.previous_league_id;
      continue;
    }
    const season = await fetchSeason(client, id, opts.currentWeek);
    log(`season ${season.league.season}: fetched ${season.matchups.length} weeks`);
    seasons.push(season);
    id = season.league.previous_league_id;
  }

  return seasons.reverse();
}

export async function fetchSeason(
  client: SleeperClient,
  leagueId: string,
  currentWeek?: number,
): Promise<RawSeason> {
  const league = await client.league(leagueId);
  const [users, rosters, winnersBracket, losersBracket, draftList] = await Promise.all([
    client.users(leagueId),
    client.rosters(leagueId),
    client.winnersBracket(leagueId).catch(() => []),
    client.losersBracket(leagueId).catch(() => []),
    client.drafts(leagueId).catch(() => []),
  ]);

  let lastWeek = lastWeekOf(league);
  if (league.status !== "complete" && currentWeek !== undefined) {
    lastWeek = Math.min(lastWeek, Math.max(0, currentWeek));
  }
  if (league.status === "pre_draft" || league.status === "drafting") lastWeek = 0;

  const matchups: SleeperMatchup[][] = [];
  const transactions: SleeperTransaction[] = [];
  for (let week = 1; week <= lastWeek; week++) {
    // Sequential on purpose: keeps us well under Sleeper's rate guidance.
    matchups.push(await client.matchups(leagueId, week));
    transactions.push(...(await client.transactions(leagueId, week)));
  }

  const drafts = [];
  for (const draft of draftList) {
    drafts.push({ draft, picks: await client.draftPicks(draft.draft_id) });
  }

  return {
    league,
    users,
    rosters,
    matchups,
    winnersBracket: winnersBracket ?? [],
    losersBracket: losersBracket ?? [],
    transactions,
    drafts,
    fetchedAt: new Date().toISOString(),
  };
}
