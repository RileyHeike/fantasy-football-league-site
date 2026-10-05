import { describe, expect, it } from "vitest";
import {
  computeAll,
  computeDraftGrades,
  DEFAULT_DRAFT_GRADE_CONFIG,
  FIXTURE_CONFIG,
  FixtureTransport,
  generateFixtureLeague,
  gradedPicksForSeason,
  importHistory,
  normalize,
  pickDetailsForSeason,
  SleeperClient,
  type DraftGradeConfig,
  type DraftPick,
  type LeagueHistory,
  type PickGrade,
  type PlayerInfo,
  type PlayerSeasonFinish,
} from "../src";

function buildLeague(draftPicks: DraftPick[], playerSeasonFinishes: PlayerSeasonFinish[], players: Record<string, PlayerInfo>): LeagueHistory {
  return { leagueName: "Test League", managers: [], seasons: [], games: [], transactions: [], draftPicks, players, playerSeasonFinishes, playerWeeklyPoints: [] };
}

// A full-season game count (17) so every fixture finish clears the default games-played gate unless a test says otherwise.
const finish = (overrides: Partial<PlayerSeasonFinish> & Pick<PlayerSeasonFinish, "playerId" | "position" | "points" | "positionRank">): PlayerSeasonFinish => ({
  season: 2023,
  gamesPlayed: 17,
  rawStats: {},
  ...overrides,
});

const RANK_ONLY_CONFIG: DraftGradeConfig = { ...DEFAULT_DRAFT_GRADE_CONFIG, rankDeltaWeight: 1, pointsDeltaWeight: 0 };
const POINTS_ONLY_CONFIG: DraftGradeConfig = { ...DEFAULT_DRAFT_GRADE_CONFIG, rankDeltaWeight: 0, pointsDeltaWeight: 1 };

const asGraded = (p: PickGrade) => p as Extract<PickGrade, { graded: true }>;
const asUngraded = (p: PickGrade) => p as Extract<PickGrade, { graded: false }>;

describe("pickDetailsForSeason", () => {
  it("ranks every position, including K and DEF", () => {
    const picks: DraftPick[] = [
      { season: 2023, round: 1, pickNo: 1, draftSlot: 1, managerId: "a", playerId: "k1" },
      { season: 2023, round: 2, pickNo: 2, draftSlot: 1, managerId: "b", playerId: "k2" },
    ];
    const finishes = [
      finish({ playerId: "k1", position: "K", points: 120, positionRank: 2 }),
      finish({ playerId: "k2", position: "K", points: 150, positionRank: 1 }),
    ];
    const players: Record<string, PlayerInfo> = { k1: { name: "K1", position: "K" }, k2: { name: "K2", position: "K" } };
    const details = pickDetailsForSeason(picks, finishes, players, 2023);
    expect(details).toHaveLength(2);
    const k1 = details.find((d) => d.playerId === "k1")!;
    expect(k1.draftRank).toBe(1);
    expect(k1.poolSize).toBe(2);
    expect(k1.finish).toEqual({ finishRank: 2, points: 120, gamesPlayed: 17, pointsPerGame: 7.06, rawStats: {} });
  });

  it("buckets a pick by the position it was ranked under, not its draft-time position", () => {
    const picks: DraftPick[] = [
      { season: 2023, round: 1, pickNo: 1, draftSlot: 1, managerId: "a", playerId: "flex" },
      { season: 2023, round: 1, pickNo: 2, draftSlot: 1, managerId: "b", playerId: "wr2" },
    ];
    const finishes = [
      finish({ playerId: "flex", position: "WR", points: 150, positionRank: 1 }),
      finish({ playerId: "wr2", position: "WR", points: 100, positionRank: 2 }),
    ];
    // Drafted as an RB, but that season's stats ranked him as a WR.
    const players: Record<string, PlayerInfo> = { flex: { name: "Flex", position: "RB" }, wr2: { name: "WR2", position: "WR" } };
    const details = pickDetailsForSeason(picks, finishes, players, 2023);
    const flex = details.find((d) => d.playerId === "flex")!;
    expect(flex.position).toBe("WR");
    expect(flex.poolSize).toBe(2);
    expect(flex.draftRank).toBe(1);
  });

  it("still counts a pick with no finish data toward its position's draft slots", () => {
    const picks: DraftPick[] = [
      { season: 2023, round: 1, pickNo: 1, draftSlot: 1, managerId: "a", playerId: "good-wr" },
      { season: 2023, round: 5, pickNo: 50, draftSlot: 1, managerId: "a", playerId: "bust-wr" },
    ];
    const finishes = [finish({ playerId: "good-wr", position: "WR", points: 200, positionRank: 1 })];
    const players: Record<string, PlayerInfo> = { "good-wr": { name: "Good WR", position: "WR" }, "bust-wr": { name: "Bust WR", position: "WR" } };
    const details = pickDetailsForSeason(picks, finishes, players, 2023);
    expect(details).toHaveLength(2);
    const good = details.find((d) => d.playerId === "good-wr")!;
    expect(good.poolSize).toBe(2);
    expect(good.draftRank).toBe(1);
    expect(details.find((d) => d.playerId === "bust-wr")!.finish).toBeUndefined();
  });
});

describe("gradedPicksForSeason", () => {
  it("scores a late pick that outperformed as a steal, via the rank-delta component", () => {
    const picks: DraftPick[] = [
      { season: 2023, round: 1, pickNo: 10, draftSlot: 1, managerId: "a", playerId: "wr-early" },
      { season: 2023, round: 2, pickNo: 20, draftSlot: 1, managerId: "b", playerId: "wr-mid" },
      { season: 2023, round: 3, pickNo: 30, draftSlot: 1, managerId: "c", playerId: "wr-late" },
    ];
    const finishes = [
      finish({ playerId: "wr-early", position: "WR", points: 150, positionRank: 2 }),
      finish({ playerId: "wr-mid", position: "WR", points: 120, positionRank: 3 }),
      finish({ playerId: "wr-late", position: "WR", points: 300, positionRank: 1 }),
    ];
    const players: Record<string, PlayerInfo> = {
      "wr-early": { name: "Early WR", position: "WR" },
      "wr-mid": { name: "Mid WR", position: "WR" },
      "wr-late": { name: "Late WR", position: "WR" },
    };
    const graded = gradedPicksForSeason(picks, finishes, players, 2023, RANK_ONLY_CONFIG);
    const late = asGraded(graded.find((g) => g.playerId === "wr-late")!);
    expect(late.draftRank).toBe(3);
    expect(late.finish.finishRank).toBe(1);
    expect(late.poolSize).toBe(3);
    expect(late.score).toBeCloseTo(2 / 3, 2);
    expect(late.grade).toBe("A+");
  });

  it("weighs actual point production: the same rank jump is worth more near the top of a position than the bottom", () => {
    const FILLER_COUNT = 20;
    const picks: DraftPick[] = Array.from({ length: FILLER_COUNT }, (_, i) => ({
      season: 2022, round: 1, pickNo: i + 1, draftSlot: i + 1, managerId: "filler", playerId: `wrFiller${i}`,
    }));
    picks[4] = { season: 2022, round: 1, pickNo: 5, draftSlot: 1, managerId: "a", playerId: "wrTopSteal" };
    picks[19] = { season: 2022, round: 1, pickNo: 20, draftSlot: 1, managerId: "b", playerId: "wrBottomSteal" };

    const players: Record<string, PlayerInfo> = {};
    for (const p of picks) players[p.playerId] = { name: p.playerId, position: "WR" };

    const finishes = [
      finish({ playerId: "wrStud", season: 2022, position: "WR", points: 300, positionRank: 1 }),
      finish({ playerId: "wrReplacementAt5", season: 2022, position: "WR", points: 220, positionRank: 5 }),
      finish({ playerId: "wrTopSteal", season: 2022, position: "WR", points: 260, positionRank: 3 }),
      finish({ playerId: "wrReplacementAt20", season: 2022, position: "WR", points: 60, positionRank: 20 }),
      finish({ playerId: "wrBottomSteal", season: 2022, position: "WR", points: 65, positionRank: 18 }),
    ];

    const graded = gradedPicksForSeason(picks, finishes, players, 2022, POINTS_ONLY_CONFIG);
    const top = asGraded(graded.find((p) => p.playerId === "wrTopSteal")!);
    const bottom = asGraded(graded.find((p) => p.playerId === "wrBottomSteal")!);
    expect(top.draftRank - top.finish.finishRank).toBe(2); // same 2-spot rank jump as bottom...
    expect(bottom.draftRank - bottom.finish.finishRank).toBe(2);
    expect(top.score).toBeCloseTo(0.41, 2); // (260 - 220) / spread, spread = stddev([260, 65]) = 97.5
    expect(bottom.score).toBeCloseTo(0.05, 2); // (65 - 60) / spread
    expect(top.score).toBeGreaterThan(bottom.score); // ...worth much more near the top of the position
  });

  it("doesn't self-shrink a pick's score just because it is the position's own #1 finisher", () => {
    // Points-delta is normalized against the spread of the whole drafted pool, not the #1 scorer's own
    // total — otherwise a pick that IS the #1 scorer compresses its own denominator toward its own value.
    const picks: DraftPick[] = [
      { season: 2024, round: 1, pickNo: 1, draftSlot: 1, managerId: "x", playerId: "other1" },
      { season: 2024, round: 1, pickNo: 2, draftSlot: 1, managerId: "x", playerId: "other2" },
      { season: 2024, round: 1, pickNo: 3, draftSlot: 1, managerId: "x", playerId: "other3" },
      { season: 2024, round: 1, pickNo: 4, draftSlot: 1, managerId: "a", playerId: "stud" }, // draftRank 4
      { season: 2024, round: 1, pickNo: 5, draftSlot: 1, managerId: "x", playerId: "other5" },
    ];
    const players: Record<string, PlayerInfo> = {};
    for (const p of picks) players[p.playerId] = { name: p.playerId, position: "RB" };
    const finishes = [
      finish({ playerId: "stud", season: 2024, position: "RB", points: 380, positionRank: 1 }), // our pick: finished #1
      finish({ playerId: "other1", season: 2024, position: "RB", points: 300, positionRank: 2 }),
      finish({ playerId: "other2", season: 2024, position: "RB", points: 280, positionRank: 3 }),
      finish({ playerId: "other3", season: 2024, position: "RB", points: 265, positionRank: 4 }), // replacement for draftRank 4
      finish({ playerId: "other5", season: 2024, position: "RB", points: 60, positionRank: 20 }),
    ];
    const graded = gradedPicksForSeason(picks, finishes, players, 2024, POINTS_ONLY_CONFIG);
    const stud = asGraded(graded.find((p) => p.playerId === "stud")!);
    expect(stud.score).toBeGreaterThan(0.8);
  });

  it("marks a pick ungraded, not a bust, when its player has no finish data — but keeps it visible", () => {
    const picks: DraftPick[] = [
      { season: 2023, round: 1, pickNo: 1, draftSlot: 1, managerId: "a", playerId: "good-wr" },
      { season: 2023, round: 5, pickNo: 50, draftSlot: 1, managerId: "a", playerId: "bust-wr" },
    ];
    const finishes = [finish({ playerId: "good-wr", position: "WR", points: 200, positionRank: 1 })];
    const players: Record<string, PlayerInfo> = { "good-wr": { name: "Good WR", position: "WR" }, "bust-wr": { name: "Bust WR", position: "WR" } };
    const graded = gradedPicksForSeason(picks, finishes, players, 2023);
    expect(graded).toHaveLength(2);
    const bust = asUngraded(graded.find((g) => g.playerId === "bust-wr")!);
    expect(bust.graded).toBe(false);
    expect(bust.reason).toBe("no-finish-data");
    expect(bust.poolSize).toBe(2); // still consumed a WR draft slot
  });

  it("marks a pick ungraded when its player played less than half the season", () => {
    const picks: DraftPick[] = [
      { season: 2023, round: 1, pickNo: 1, draftSlot: 1, managerId: "a", playerId: "injured" },
      { season: 2023, round: 2, pickNo: 2, draftSlot: 1, managerId: "b", playerId: "healthy" },
    ];
    const finishes = [
      // Full season is 17 games (healthy's gamesPlayed sets the season max); injured played 6, well under half.
      finish({ playerId: "injured", position: "WR", points: 60, positionRank: 20, gamesPlayed: 6 }),
      finish({ playerId: "healthy", position: "WR", points: 180, positionRank: 1, gamesPlayed: 17 }),
    ];
    const players: Record<string, PlayerInfo> = { injured: { name: "Injured", position: "WR" }, healthy: { name: "Healthy", position: "WR" } };
    const graded = gradedPicksForSeason(picks, finishes, players, 2023);
    const injured = asUngraded(graded.find((g) => g.playerId === "injured")!);
    expect(injured.graded).toBe(false);
    expect(injured.reason).toBe("insufficient-games-played");
  });

  it("excludes K and DEF picks even when a finish exists", () => {
    const picks: DraftPick[] = [{ season: 2023, round: 10, pickNo: 100, draftSlot: 1, managerId: "a", playerId: "kicker1" }];
    const finishes = [finish({ playerId: "kicker1", position: "K", points: 120, positionRank: 1 })];
    const players: Record<string, PlayerInfo> = { kicker1: { name: "Kicker", position: "K" } };
    expect(gradedPicksForSeason(picks, finishes, players, 2023)).toEqual([]);
  });
});

describe("computeDraftGrades", () => {
  it("omits a manager/season entirely when every pick is ungraded", () => {
    const league = buildLeague(
      [
        { season: 2023, round: 1, pickNo: 1, draftSlot: 1, managerId: "a", playerId: "kicker1" },
        { season: 2023, round: 2, pickNo: 2, draftSlot: 1, managerId: "a", playerId: "bust-wr" },
        { season: 2023, round: 3, pickNo: 3, draftSlot: 1, managerId: "b", playerId: "good-wr" },
      ],
      [
        finish({ playerId: "kicker1", position: "K", points: 100, positionRank: 1 }),
        finish({ playerId: "good-wr", position: "WR", points: 200, positionRank: 1 }),
      ],
      { kicker1: { name: "Kicker", position: "K" }, "bust-wr": { name: "Bust", position: "WR" }, "good-wr": { name: "Good", position: "WR" } },
    );
    const result = computeDraftGrades(league);
    expect(result.bySeason[2023]!.some((row) => row.managerId === "a")).toBe(false);
    const bRow = result.bySeason[2023]!.find((row) => row.managerId === "b")!;
    expect(bRow.pickCount).toBe(1);
  });

  it("keeps ungraded picks visible in a manager's pick list without counting them toward the grade", () => {
    const league = buildLeague(
      [
        { season: 2023, round: 1, pickNo: 1, draftSlot: 1, managerId: "a", playerId: "injured" },
        { season: 2023, round: 2, pickNo: 2, draftSlot: 1, managerId: "a", playerId: "healthyA" },
        { season: 2023, round: 3, pickNo: 3, draftSlot: 1, managerId: "b", playerId: "healthyB" },
      ],
      [
        finish({ playerId: "injured", position: "WR", points: 60, positionRank: 3, gamesPlayed: 5 }),
        finish({ playerId: "healthyA", position: "WR", points: 150, positionRank: 2 }),
        finish({ playerId: "healthyB", position: "WR", points: 200, positionRank: 1 }),
      ],
      { injured: { name: "Injured", position: "WR" }, healthyA: { name: "HealthyA", position: "WR" }, healthyB: { name: "HealthyB", position: "WR" } },
    );
    const row = computeDraftGrades(league).bySeason[2023]!.find((r) => r.managerId === "a")!;
    expect(row.pickCount).toBe(1); // only healthyA counts toward the grade
    expect(row.picks).toHaveLength(2); // but both picks are still listed
    expect(row.picks.some((p) => p.playerId === "injured" && !p.graded)).toBe(true);
  });

  it("weighs a round-1 pick more than a round-10 pick in the manager's average", () => {
    const league = buildLeague(
      [
        { season: 2023, round: 1, pickNo: 1, draftSlot: 1, managerId: "x", playerId: "r1b" },
        { season: 2023, round: 1, pickNo: 2, draftSlot: 1, managerId: "a", playerId: "r1a" }, // beats its slot: score +0.5
        { season: 2023, round: 10, pickNo: 3, draftSlot: 1, managerId: "a", playerId: "r10a" }, // misses its slot by the same magnitude: score -0.5
        { season: 2023, round: 10, pickNo: 4, draftSlot: 1, managerId: "x", playerId: "r10b" },
      ],
      [
        finish({ playerId: "r1a", position: "WR", points: 200, positionRank: 1 }),
        finish({ playerId: "r1b", position: "WR", points: 100, positionRank: 2 }),
        finish({ playerId: "r10a", position: "RB", points: 50, positionRank: 2 }),
        finish({ playerId: "r10b", position: "RB", points: 150, positionRank: 1 }),
      ],
      {
        r1a: { name: "r1a", position: "WR" }, r1b: { name: "r1b", position: "WR" },
        r10a: { name: "r10a", position: "RB" }, r10b: { name: "r10b", position: "RB" },
      },
    );
    const row = computeDraftGrades(league, RANK_ONLY_CONFIG).bySeason[2023]!.find((r) => r.managerId === "a")!;
    // Flat average would be 0; harmonic round-weighting (1 vs 0.1) pulls it much closer to the round-1 score.
    expect(row.averageScore).toBeCloseTo(0.41, 2);
  });

  it("pools every graded pick across seasons for the career average, rather than averaging season averages", () => {
    // Every pick is round 1 so roundWeight is constant across the board, isolating flat-pooling from round-weighting.
    const league = buildLeague(
      [
        { season: 2022, round: 1, pickNo: 2, draftSlot: 1, managerId: "a", playerId: "p1" },
        { season: 2022, round: 1, pickNo: 1, draftSlot: 1, managerId: "x", playerId: "p1b" },
        { season: 2023, round: 1, pickNo: 1, draftSlot: 1, managerId: "a", playerId: "p2" },
        { season: 2023, round: 1, pickNo: 2, draftSlot: 1, managerId: "x", playerId: "p2b" },
        { season: 2023, round: 1, pickNo: 3, draftSlot: 1, managerId: "a", playerId: "p3" },
        { season: 2023, round: 1, pickNo: 4, draftSlot: 1, managerId: "x", playerId: "p3b" },
        { season: 2023, round: 1, pickNo: 5, draftSlot: 1, managerId: "a", playerId: "p4" },
        { season: 2023, round: 1, pickNo: 6, draftSlot: 1, managerId: "x", playerId: "p4b" },
      ],
      [
        finish({ playerId: "p1", season: 2022, position: "WR", points: 200, positionRank: 1 }),
        finish({ playerId: "p2", season: 2023, position: "WR", points: 50, positionRank: 2 }),
        finish({ playerId: "p2b", season: 2023, position: "WR", points: 200, positionRank: 1 }),
        finish({ playerId: "p3", season: 2023, position: "RB", points: 50, positionRank: 2 }),
        finish({ playerId: "p3b", season: 2023, position: "RB", points: 200, positionRank: 1 }),
        finish({ playerId: "p4", season: 2023, position: "TE", points: 50, positionRank: 2 }),
        finish({ playerId: "p4b", season: 2023, position: "TE", points: 200, positionRank: 1 }),
      ],
      {
        p1: { name: "p1", position: "WR" }, p1b: { name: "p1b", position: "WR" },
        p2: { name: "p2", position: "WR" }, p2b: { name: "p2b", position: "WR" },
        p3: { name: "p3", position: "RB" }, p3b: { name: "p3b", position: "RB" },
        p4: { name: "p4", position: "TE" }, p4b: { name: "p4b", position: "TE" },
      },
    );
    const result = computeDraftGrades(league, RANK_ONLY_CONFIG);
    expect(result.bySeason[2022]!.find((r) => r.managerId === "a")!.averageScore).toBeCloseTo(0.5, 2);
    expect(result.bySeason[2023]!.find((r) => r.managerId === "a")!.averageScore).toBeCloseTo(-0.5, 2);
    // Mean-of-season-means would be (0.5 + -0.5) / 2 = 0. Flat-pooled over 4 picks is -0.25.
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
