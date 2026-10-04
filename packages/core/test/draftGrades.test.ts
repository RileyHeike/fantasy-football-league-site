import { describe, expect, it } from "vitest";
import {
  computeAll,
  computeDraftGrades,
  FIXTURE_CONFIG,
  FixtureTransport,
  generateFixtureLeague,
  gradedPicksForSeason,
  importHistory,
  normalize,
  SleeperClient,
  type DraftPick,
  type LeagueHistory,
  type PlayerInfo,
  type PlayerSeasonFinish,
} from "../src";

function buildLeague(draftPicks: DraftPick[], playerSeasonFinishes: PlayerSeasonFinish[], players: Record<string, PlayerInfo>): LeagueHistory {
  return { leagueName: "Test League", managers: [], seasons: [], games: [], transactions: [], draftPicks, players, playerSeasonFinishes, playerWeeklyPoints: [] };
}

describe("gradedPicksForSeason", () => {
  it("grades a late pick that outperformed as a steal", () => {
    const picks: DraftPick[] = [
      { season: 2023, round: 1, pickNo: 10, managerId: "a", playerId: "wr-early" },
      { season: 2023, round: 2, pickNo: 20, managerId: "b", playerId: "wr-mid" },
      { season: 2023, round: 3, pickNo: 30, managerId: "c", playerId: "wr-late" },
    ];
    const finishes: PlayerSeasonFinish[] = [
      { playerId: "wr-early", season: 2023, position: "WR", points: 150, positionRank: 2 },
      { playerId: "wr-mid", season: 2023, position: "WR", points: 120, positionRank: 3 },
      { playerId: "wr-late", season: 2023, position: "WR", points: 300, positionRank: 1 },
    ];
    const players: Record<string, PlayerInfo> = {
      "wr-early": { name: "Early WR", position: "WR" },
      "wr-mid": { name: "Mid WR", position: "WR" },
      "wr-late": { name: "Late WR", position: "WR" },
    };
    const graded = gradedPicksForSeason(picks, finishes, players, 2023);
    const late = graded.find((g) => g.playerId === "wr-late")!;
    expect(late.draftRank).toBe(3);
    expect(late.finishRank).toBe(1);
    expect(late.poolSize).toBe(3);
    expect(late.score).toBeCloseTo(2 / 3, 2);
    expect(late.grade).toBe("A+");
  });

  it("excludes a picked player with no season finish, without dropping its draft slot", () => {
    const picks: DraftPick[] = [
      { season: 2023, round: 1, pickNo: 1, managerId: "a", playerId: "good-wr" },
      { season: 2023, round: 5, pickNo: 50, managerId: "a", playerId: "bust-wr" },
    ];
    const finishes: PlayerSeasonFinish[] = [{ playerId: "good-wr", season: 2023, position: "WR", points: 200, positionRank: 1 }];
    const players: Record<string, PlayerInfo> = {
      "good-wr": { name: "Good WR", position: "WR" },
      "bust-wr": { name: "Bust WR", position: "WR" },
    };
    const graded = gradedPicksForSeason(picks, finishes, players, 2023);
    expect(graded).toHaveLength(1);
    expect(graded[0]!.playerId).toBe("good-wr");
    // The bust still consumed a WR draft slot that season.
    expect(graded[0]!.poolSize).toBe(2);
    expect(graded[0]!.draftRank).toBe(1);
  });

  it("normalizes the same raw rank delta differently across position pool sizes", () => {
    const tePicks: DraftPick[] = Array.from({ length: 4 }, (_, i) => ({
      season: 2023, round: 1, pickNo: i + 1, managerId: "m", playerId: `te${i}`,
    }));
    const wrPicks: DraftPick[] = Array.from({ length: 20 }, (_, i) => ({
      season: 2023, round: 1, pickNo: 100 + i, managerId: "m", playerId: `wr${i}`,
    }));
    const players: Record<string, PlayerInfo> = {};
    for (const p of [...tePicks]) players[p.playerId] = { name: p.playerId, position: "TE" };
    for (const p of [...wrPicks]) players[p.playerId] = { name: p.playerId, position: "WR" };
    const finishes: PlayerSeasonFinish[] = [
      { playerId: "te3", season: 2023, position: "TE", points: 100, positionRank: 2 }, // draftRank 4, delta 2
      { playerId: "wr19", season: 2023, position: "WR", points: 100, positionRank: 18 }, // draftRank 20, delta 2
    ];
    const graded = gradedPicksForSeason([...tePicks, ...wrPicks], finishes, players, 2023);
    const te = graded.find((g) => g.playerId === "te3")!;
    const wr = graded.find((g) => g.playerId === "wr19")!;
    expect(te.score).toBeCloseTo(0.5, 2);
    expect(wr.score).toBeCloseTo(0.1, 2);
    expect(te.score).toBeGreaterThan(wr.score);
  });

  it("excludes K and DEF picks even when a finish exists", () => {
    const picks: DraftPick[] = [{ season: 2023, round: 10, pickNo: 100, managerId: "a", playerId: "kicker1" }];
    const finishes: PlayerSeasonFinish[] = [{ playerId: "kicker1", season: 2023, position: "K", points: 120, positionRank: 1 }];
    const players: Record<string, PlayerInfo> = { kicker1: { name: "Kicker", position: "K" } };
    expect(gradedPicksForSeason(picks, finishes, players, 2023)).toEqual([]);
  });

  it("buckets a pick by the position it was ranked under, not its draft-time position", () => {
    const picks: DraftPick[] = [
      { season: 2023, round: 1, pickNo: 1, managerId: "a", playerId: "flex" },
      { season: 2023, round: 1, pickNo: 2, managerId: "b", playerId: "wr2" },
    ];
    const finishes: PlayerSeasonFinish[] = [
      { playerId: "flex", season: 2023, position: "WR", points: 150, positionRank: 1 },
      { playerId: "wr2", season: 2023, position: "WR", points: 100, positionRank: 2 },
    ];
    // Drafted as an RB, but that season's stats ranked him as a WR.
    const players: Record<string, PlayerInfo> = {
      flex: { name: "Flex", position: "RB" },
      wr2: { name: "WR2", position: "WR" },
    };
    const graded = gradedPicksForSeason(picks, finishes, players, 2023);
    const flex = graded.find((g) => g.playerId === "flex")!;
    expect(flex.position).toBe("WR");
    expect(flex.poolSize).toBe(2);
    expect(flex.draftRank).toBe(1);
  });
});

describe("computeDraftGrades", () => {
  it("omits a manager/season entirely when every pick is ungraded", () => {
    const league = buildLeague(
      [
        { season: 2023, round: 1, pickNo: 1, managerId: "a", playerId: "kicker1" },
        { season: 2023, round: 2, pickNo: 2, managerId: "a", playerId: "bust-wr" },
        { season: 2023, round: 3, pickNo: 3, managerId: "b", playerId: "good-wr" },
      ],
      [
        { playerId: "kicker1", season: 2023, position: "K", points: 100, positionRank: 1 },
        { playerId: "good-wr", season: 2023, position: "WR", points: 200, positionRank: 1 },
      ],
      {
        kicker1: { name: "Kicker", position: "K" },
        "bust-wr": { name: "Bust", position: "WR" },
        "good-wr": { name: "Good", position: "WR" },
      },
    );
    const result = computeDraftGrades(league);
    expect(result.bySeason[2023]!.some((row) => row.managerId === "a")).toBe(false);
    expect(result.bySeason[2023]!.find((row) => row.managerId === "b")!.pickCount).toBe(1);
  });

  it("pools every graded pick across seasons for the career average, rather than averaging season averages", () => {
    const league = buildLeague(
      [
        // 2022: manager a's only pick is the better half of a 2-pick WR class → score +0.5.
        { season: 2022, round: 1, pickNo: 2, managerId: "a", playerId: "p1" },
        { season: 2022, round: 1, pickNo: 1, managerId: "x", playerId: "p1b" },
        // 2023: manager a has three picks, each the worse half of a 2-pick class → score -0.5 apiece.
        { season: 2023, round: 1, pickNo: 1, managerId: "a", playerId: "p2" },
        { season: 2023, round: 1, pickNo: 2, managerId: "x", playerId: "p2b" },
        { season: 2023, round: 2, pickNo: 3, managerId: "a", playerId: "p3" },
        { season: 2023, round: 2, pickNo: 4, managerId: "x", playerId: "p3b" },
        { season: 2023, round: 3, pickNo: 5, managerId: "a", playerId: "p4" },
        { season: 2023, round: 3, pickNo: 6, managerId: "x", playerId: "p4b" },
      ],
      [
        { playerId: "p1", season: 2022, position: "WR", points: 200, positionRank: 1 },
        { playerId: "p2", season: 2023, position: "WR", points: 50, positionRank: 2 },
        { playerId: "p2b", season: 2023, position: "WR", points: 200, positionRank: 1 },
        { playerId: "p3", season: 2023, position: "RB", points: 50, positionRank: 2 },
        { playerId: "p3b", season: 2023, position: "RB", points: 200, positionRank: 1 },
        { playerId: "p4", season: 2023, position: "TE", points: 50, positionRank: 2 },
        { playerId: "p4b", season: 2023, position: "TE", points: 200, positionRank: 1 },
      ],
      {
        p1: { name: "p1", position: "WR" }, p1b: { name: "p1b", position: "WR" },
        p2: { name: "p2", position: "WR" }, p2b: { name: "p2b", position: "WR" },
        p3: { name: "p3", position: "RB" }, p3b: { name: "p3b", position: "RB" },
        p4: { name: "p4", position: "TE" }, p4b: { name: "p4b", position: "TE" },
      },
    );
    const result = computeDraftGrades(league);
    expect(result.bySeason[2022]!.find((r) => r.managerId === "a")!.averageScore).toBeCloseTo(0.5, 2);
    expect(result.bySeason[2023]!.find((r) => r.managerId === "a")!.averageScore).toBeCloseTo(-0.5, 2);
    // Mean-of-season-means would be (0.5 + -0.5) / 2 = 0 (grade B-). Flat-pooled over 4 picks is -0.25 (grade C-).
    const career = result.career.find((r) => r.managerId === "a")!;
    expect(career.pickCount).toBe(4);
    expect(career.averageScore).toBeCloseTo(-0.25, 2);
    expect(career.grade).toBe("C-");
  });
});

describe("draftGrades stat module", () => {
  it("runs end-to-end on the fixture league without throwing, grading nothing when there's no finish data", async () => {
    const data = generateFixtureLeague();
    const client = new SleeperClient(new FixtureTransport(data));
    const raw = await importHistory(client, data.currentLeagueId, { currentWeek: data.state.week });
    const league = normalize(raw, { config: FIXTURE_CONFIG });
    const results = computeAll(league);
    expect(results.draftGrades.bySeason).toEqual({});
    expect(results.draftGrades.career).toEqual([]);
  });
});
