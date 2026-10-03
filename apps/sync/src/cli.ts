/**
 * Local sync:
 *   npm run sync:fixture              generated demo league, no network
 *   npm run sync -- --league <id>     real league (or set leagueId in content/league.config.json)
 */
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { FIXTURE_CONFIG, FixtureTransport, HttpTransport, SleeperClient, SleeperStatsClient, type LeagueConfig } from "@league/core";
import { FilePlayerStatsStore, FilePlayerWeeklyStore, FileRawStore, FileSnapshotStore } from "./fileStore";
import { runSync } from "./sync";

const root = resolve(import.meta.dirname, "../../..");
const { values } = parseArgs({
  options: {
    fixture: { type: "boolean", default: false },
    league: { type: "string" },
    out: { type: "string", default: join(root, "data") },
  },
});

const fixture = values.fixture;
const config: LeagueConfig = fixture
  ? FIXTURE_CONFIG
  : JSON.parse(await readFile(join(root, "content/league.config.json"), "utf8"));
const transport = fixture ? new FixtureTransport() : new HttpTransport();
const leagueId = fixture ? (transport as FixtureTransport).data.currentLeagueId : (values.league ?? config.leagueId);

if (!leagueId || leagueId === "YOUR_SLEEPER_LEAGUE_ID") {
  console.error("Set leagueId in content/league.config.json or pass --league <id>.");
  process.exit(1);
}

const out = values.out!;
const dir = fixture ? join(out, "fixture") : out;
const client = new SleeperClient(transport);
// Names any player who was never drafted (waiver/free-agent pickups) but appeared in a box score.
// Skipped for the fixture demo, which has no network and synthesizes its own player metadata.
const players = fixture ? undefined : await client.players();
await runSync({
  client,
  raw: new FileRawStore(join(dir, "raw")),
  snapshots: new FileSnapshotStore(join(out, "snapshot.json")),
  config,
  leagueId,
  players,
  // Draft/trade/waiver grades. Skipped for the fixture demo — no real transactions to grade.
  statsClient: fixture ? undefined : new SleeperStatsClient(),
  playerStats: fixture ? undefined : new FilePlayerStatsStore(join(out, "playerStats")),
  playerWeekly: fixture ? undefined : new FilePlayerWeeklyStore(join(out, "playerWeekly")),
});
