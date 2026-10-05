import { normalize, type NormalizeOptions } from "./model/normalize";
import type { LeagueHistory } from "./model/types";
import type { RawSeason } from "./sleeper/history";
import { computeAll, type StatResults } from "./stats";

/**
 * The single artifact the website reads at build time. Bump SCHEMA_VERSION on
 * breaking changes so an old snapshot is rejected instead of half-rendering.
 */
// Bumped 3 -> 4: PlayerSeasonFinish gained gamesPlayed and rawStats.
// Bumped 4 -> 5: DraftPick gained draftSlot.
export const SCHEMA_VERSION = 5;

export interface LeagueSnapshot {
  schemaVersion: number;
  generatedAt: string;
  /** Current season and week when the snapshot was built. */
  nfl: { season: number; week: number };
  league: LeagueHistory;
  stats: StatResults;
}

export function buildSnapshot(
  raw: RawSeason[],
  nfl: { season: number; week: number },
  opts: NormalizeOptions = {},
): LeagueSnapshot {
  const league = normalize(raw, opts);
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    nfl,
    league,
    stats: computeAll(league),
  };
}

export function assertSnapshot(x: unknown): asserts x is LeagueSnapshot {
  const v = (x as LeagueSnapshot | null)?.schemaVersion;
  if (v !== SCHEMA_VERSION) {
    throw new Error(`Snapshot schema ${v} does not match expected ${SCHEMA_VERSION}. Re-run the sync.`);
  }
}
