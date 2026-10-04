import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  assertSnapshot,
  buildSnapshot,
  FIXTURE_CONFIG,
  FixtureTransport,
  generateFixtureLeague,
  HttpTransport,
  importHistory,
  normalize,
  ordinal,
  pairMatchups,
  scorePoints,
  SleeperClient,
  type LeagueSnapshot,
  type RawSeason,
  type SleeperMatchup,
  type SleeperPlayerStatLine,
} from "../src";

let raw: RawSeason[];
let snap: LeagueSnapshot;
const data = generateFixtureLeague();

beforeAll(async () => {
  const client = new SleeperClient(new FixtureTransport(data));
  raw = await importHistory(client, data.currentLeagueId, { currentWeek: data.state.week });
  snap = buildSnapshot(raw, { season: 2026, week: data.state.week }, { config: FIXTURE_CONFIG });
});

describe("importHistory", () => {
  it("walks previous_league_id back to the first season, oldest first", () => {
    expect(raw.map((s) => s.league.season)).toEqual(["2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
  });

  it("fetches full seasons when complete and stops at the current week otherwise", () => {
    expect(raw[0]!.matchups).toHaveLength(17);
    expect(raw.at(-1)!.matchups).toHaveLength(4);
  });

  it("reuses stored completed seasons instead of re-fetching them", async () => {
    const transport = new FixtureTransport(data);
    const spy = vi.spyOn(transport, "get");
    await importHistory(new SleeperClient(transport), data.currentLeagueId, { existing: raw, currentWeek: 4 });
    const leagueCalls = spy.mock.calls.filter(([p]) => /^\/league\/\d+$/.test(p as string));
    expect(leagueCalls).toHaveLength(1); // only the in-progress season
  });
});

describe("pairMatchups", () => {
  it("pairs rows by matchup_id and skips teams without a game", () => {
    const row = (roster_id: number, matchup_id: number | null) =>
      ({ roster_id, matchup_id, points: 100, starters: [], players: [] }) as SleeperMatchup;
    const pairs = pairMatchups([row(2, 1), row(5, null), row(1, 1), row(3, 2), row(4, 2)]);
    expect(pairs.map(([a, b]) => [a.roster_id, b.roster_id])).toEqual([[1, 2], [3, 4]]);
  });
});

describe("normalize", () => {
  it("merges one person's multiple Sleeper accounts via config", () => {
    const riley = snap.league.managers.find((m) => m.id === "riley")!;
    expect(riley.userIds).toEqual(["u_riley", "u_riley_new"]);
    expect([riley.firstSeason, riley.lastSeason]).toEqual([2020, 2026]);
    expect(snap.league.managers.filter((m) => m.name === "Riley")).toHaveLength(1);
  });

  it("tracks managers who joined and left", () => {
    const ozzie = snap.league.managers.find((m) => m.id === "ozzie")!;
    const nadia = snap.league.managers.find((m) => m.id === "nadia")!;
    expect(ozzie.lastSeason).toBe(2021);
    expect(nadia.firstSeason).toBe(2022);
    expect(snap.league.managers).toHaveLength(13);
  });

  it("classifies regular, playoff and consolation games", () => {
    const s2020 = snap.league.games.filter((g) => g.season === 2020);
    expect(s2020.filter((g) => g.kind === "regular")).toHaveLength(14 * 6);
    expect(s2020.filter((g) => g.kind === "playoff")).toHaveLength(7);
    expect(s2020.filter((g) => g.placement === 1 && g.kind === "playoff")).toHaveLength(1);
  });

  it("marks only scored weeks of the current season as final", () => {
    const current = snap.league.games.filter((g) => g.season === 2026);
    expect(current.filter((g) => g.final).map((g) => g.week).every((w) => w <= 3)).toBe(true);
    expect(current.filter((g) => !g.final).every((g) => g.week === 4 && g.winnerId === null)).toBe(true);
  });

  it("names champions from the winners bracket", () => {
    for (const s of snap.league.seasons.filter((x) => x.status === "complete")) {
      const final = snap.league.games.find((g) => g.season === s.year && g.kind === "playoff" && g.placement === 1)!;
      expect(s.placements.champion).toBe(final.winnerId);
      expect(s.placements.last).toBeDefined();
    }
    expect(snap.league.seasons.at(-1)!.placements).toEqual({});
  });

  it("builds a resolvable winners-bracket tree with managerIds", () => {
    const s2020 = snap.league.seasons.find((s) => s.year === 2020)!;
    expect(s2020.winnersBracket).toHaveLength(7);
    const final = s2020.winnersBracket.find((b) => b.placement === 1)!;
    expect(final.round).toBe(3);
    expect(final.team1From).toBeDefined();
    expect(final.team2From).toBeDefined();
    expect(final.winnerId).toBe(s2020.placements.champion);
    const round1 = s2020.winnersBracket.filter((b) => b.round === 1);
    for (const b of round1) {
      expect(typeof b.team1).toBe("string");
      expect(typeof b.team2).toBe("string");
      expect(b.winnerId === b.team1 || b.winnerId === b.team2).toBe(true);
    }
  });

  it("has no bracket yet for a season still in its regular season", () => {
    const current = snap.league.seasons.at(-1)!;
    expect(current.winnersBracket).toEqual([]);
    expect(current.losersBracket).toEqual([]);
  });
});

describe("scorePoints", () => {
  it("dot-products raw stat categories against a league's own scoring settings", () => {
    const stats = { rec: 5, rec_yd: 60, rec_td: 1, fgm_yds: 45 };
    const settings = { rec: 1, rec_yd: 0.1, rec_td: 6 };
    // fgm_yds has no weight in these settings and must not contribute.
    expect(scorePoints(stats, settings)).toBe(5 * 1 + 60 * 0.1 + 1 * 6);
  });

  it("ignores categories the stat line doesn't have", () => {
    expect(scorePoints({ rec: 3 }, { rec: 1, rec_td: 6 })).toBe(3);
  });
});

describe("player-finish pipeline", () => {
  // Fixture league scoring: { rec: 0.5, pass_td: 4, rush_td: 6, rec_td: 6 }.
  it("ranks players within position by points scored under that season's own settings", () => {
    const playerSeasonStats: Record<number, SleeperPlayerStatLine[]> = {
      2020: [
        { player_id: "p1", player: { position: "RB" }, stats: { rush_td: 3, rec: 4, rec_td: 1, gp: 14 } }, // 18 + 2 + 6 = 26
        { player_id: "p2", player: { position: "RB" }, stats: { rush_td: 1 } }, // 6
        { player_id: "p3", player: { position: "WR" }, stats: { rec: 10, rec_td: 2 } }, // 5 + 12 = 17
      ],
    };
    const league = normalize(raw, { config: FIXTURE_CONFIG, playerSeasonStats });
    const rbs = league.playerSeasonFinishes.filter((f) => f.season === 2020 && f.position === "RB");
    expect(rbs).toEqual([
      { playerId: "p1", season: 2020, position: "RB", points: 26, positionRank: 1, gamesPlayed: 14, rawStats: playerSeasonStats[2020]![0]!.stats },
      { playerId: "p2", season: 2020, position: "RB", points: 6, positionRank: 2, gamesPlayed: 0, rawStats: playerSeasonStats[2020]![1]!.stats },
    ]);
    const wrs = league.playerSeasonFinishes.filter((f) => f.season === 2020 && f.position === "WR");
    expect(wrs).toEqual([
      { playerId: "p3", season: 2020, position: "WR", points: 17, positionRank: 1, gamesPlayed: 0, rawStats: playerSeasonStats[2020]![2]!.stats },
    ]);
  });

  it("scores each week independently for the weekly-points pipeline", () => {
    const playerWeeklyStats: Record<string, Record<string, SleeperPlayerStatLine>> = {
      "p1-2020": {
        "1": { player_id: "p1", stats: { rush_td: 1 } }, // 6
        "2": { player_id: "p1", stats: { rec: 2, rec_td: 1 } }, // 1 + 6 = 7
      },
    };
    const league = normalize(raw, { config: FIXTURE_CONFIG, playerWeeklyStats });
    expect(league.playerWeeklyPoints).toEqual([
      { playerId: "p1", season: 2020, week: 1, points: 6 },
      { playerId: "p1", season: 2020, week: 2, points: 7 },
    ]);
  });

  it("is empty when no player-stats options are given", () => {
    const league = normalize(raw, { config: FIXTURE_CONFIG });
    expect(league.playerSeasonFinishes).toEqual([]);
    expect(league.playerWeeklyPoints).toEqual([]);
  });
});

describe("stats", () => {
  it("regular-season standings match Sleeper's own roster records", () => {
    for (const rs of raw.filter((s) => s.league.status === "complete")) {
      const year = Number(rs.league.season);
      const standings = snap.stats.standings.bySeason[year]!;
      const season = snap.league.seasons.find((s) => s.year === year)!;
      for (const roster of rs.rosters) {
        const managerId = season.teams.find((t) => t.rosterId === roster.roster_id)!.managerId;
        const line = standings.find((l) => l.managerId === managerId)!;
        expect([line.wins, line.losses]).toEqual([roster.settings.wins, roster.settings.losses]);
      }
    }
  });

  it("head-to-head is symmetric", () => {
    const h = snap.stats.headToHead;
    for (const a of Object.keys(h)) {
      for (const b of Object.keys(h[a]!)) {
        expect(h[a]![b]!.wins).toBe(h[b]![a]!.losses);
        expect(h[a]![b]!.pointsFor).toBeCloseTo(h[b]![a]!.pointsAgainst, 2);
      }
    }
  });

  it("the highest-score record beats every final game", () => {
    const high = snap.stats.records.find((r) => r.id === "high-score")!;
    const max = Math.max(...snap.league.games.filter((g) => g.final).flatMap((g) => [g.home.points, g.away.points]));
    expect(high.value).toBe(max);
    expect(high.runnersUp).toHaveLength(9);
  });

  it("streak records carry a start and end week, in order", () => {
    const streak = snap.stats.records.find((r) => r.id === "win-streak")!;
    for (const h of [streak, ...streak.runnersUp]) {
      expect(h.endSeason).toBeDefined();
      expect(h.endWeek).toBeDefined();
      expect(h.endSeason! > h.season! || (h.endSeason === h.season && h.endWeek! >= h.week!)).toBe(true);
    }
  });

  it("expected wins sum to actual wins across a season (all-play is zero-sum)", () => {
    const lines = snap.stats.advanced.filter((l) => l.season === 2023);
    const exp = lines.reduce((n, l) => n + l.expectedWins, 0);
    const act = lines.reduce((n, l) => n + l.actualWins, 0);
    expect(exp).toBeCloseTo(act, 0);
  });

  it("career championships add up to completed seasons", () => {
    const titles = snap.stats.standings.career.reduce((n, c) => n + c.championships, 0);
    expect(titles).toBe(6);
    expect(snap.stats.trophies).toHaveLength(6);
    expect(snap.stats.trophies[0]!.season).toBe(2025);
  });
});

describe("snapshot", () => {
  it("rejects snapshots from a different schema version", () => {
    expect(() => assertSnapshot({ ...snap, schemaVersion: 0 })).toThrow(/Re-run the sync/);
    expect(() => assertSnapshot(snap)).not.toThrow();
  });
});

describe("HttpTransport", () => {
  it("retries 429s and then succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      return calls < 2
        ? new Response("slow down", { status: 429 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;
    vi.useFakeTimers();
    const p = new HttpTransport({ fetchImpl, minIntervalMs: 0 }).get<{ ok: boolean }>("/state/nfl");
    await vi.runAllTimersAsync();
    expect(await p).toEqual({ ok: true });
    vi.useRealTimers();
  });

  it("does not retry 404s", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(new HttpTransport({ fetchImpl, minIntervalMs: 0 }).get("/league/x")).rejects.toThrow(/404/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("format", () => {
  it("ordinal", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"],
    );
  });
});
