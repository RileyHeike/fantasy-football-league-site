/**
 * Generates a believable multi-season league in the exact shapes the Sleeper
 * API returns. Used for tests, local development and design work before the
 * real league ID is wired in. Deterministic: same seed, same league.
 */
import type { SleeperTransport } from "../sleeper/client";
import type {
  SleeperBracketMatch,
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperMatchup,
  SleeperNflState,
  SleeperRoster,
  SleeperTransaction,
  SleeperUser,
} from "../sleeper/types";

export interface FixtureOptions {
  seed?: number;
  firstSeason?: number;
  /** Completed seasons; one more in-progress season is added after them. */
  completedSeasons?: number;
  currentWeek?: number;
  teams?: number;
}

interface FixtureLeague {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  matchups: SleeperMatchup[][];
  winners: SleeperBracketMatch[];
  losers: SleeperBracketMatch[];
  transactions: SleeperTransaction[][];
  drafts: SleeperDraft[];
  picks: Record<string, SleeperDraftPick[]>;
}

export interface FixtureData {
  currentLeagueId: string;
  state: SleeperNflState;
  leagues: Map<string, FixtureLeague>;
}

const MANAGERS: [string, string, number][] = [
  // display_name, team name, skill (mean weekly points)
  ["Riley", "Riley's Rejects", 122],
  ["BigMike", "Mike Drop", 118],
  ["Tasha", "Hurts So Good", 126],
  ["Dev", "Dev Null Defense", 112],
  ["JordanK", "CeeDee's Nuts", 116],
  ["Sam", "Sam's Club", 110],
  ["Priya", "Bijan Mustard", 124],
  ["Coop", "Coop de Grace", 108],
  ["Lena", "Lamb Chops", 120],
  ["Marcus", "Show Me Your TDs", 114],
  ["Hank", "Hank the Tank", 106],
  ["Ozzie", "Ozzie Osbournes", 113],
];
/** Joins in place of Ozzie from the third season on. */
const NEWCOMER: [string, string, number] = ["Nadia", "Nacua Matata", 119];

const POSITIONS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"];
const FIRST = ["Jalen", "Tyreek", "Bijan", "Puka", "Breece", "Amon-Ra", "Garrett", "Sam", "Kyren", "Rome", "Zay", "Tank", "Josh", "Davante", "Chase", "Drake", "Jahmyr", "Malik", "Trey", "Dalton"];
const LAST = ["Hartley", "Moreno", "Castillo", "Okafor", "Lindqvist", "Brennan", "Achebe", "Delacroix", "Whitfield", "Nakamura", "Ferreira", "Oduya", "Rasmussen", "Calloway", "Barrow", "Kowalski", "Pemberton", "Ashby", "Mbeki", "Vance"];
const POS_POOL = ["QB", "RB", "WR", "TE", "K", "DEF"];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateFixtureLeague(opts: FixtureOptions = {}): FixtureData {
  const rand = rng(opts.seed ?? 2020);
  const normal = (mean: number, sd: number) => {
    const u = 1 - rand();
    const v = rand();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const first = opts.firstSeason ?? 2020;
  const total = (opts.completedSeasons ?? 6) + 1;
  const currentWeek = opts.currentWeek ?? 4;
  const nTeams = opts.teams ?? 12;

  // Player pool shared across seasons
  const players: { id: string; first: string; last: string; pos: string; base: number }[] = [];
  for (let i = 0; i < 400; i++) {
    const pos = POS_POOL[i % POS_POOL.length]!;
    players.push({
      id: String(1000 + i),
      first: FIRST[Math.floor(rand() * FIRST.length)]!,
      last: LAST[Math.floor(rand() * LAST.length)]!,
      pos,
      base: pos === "K" || pos === "DEF" ? 8 : pos === "TE" ? 9 : pos === "QB" ? 18 : 12,
    });
  }

  const leagues = new Map<string, FixtureLeague>();
  let prevId: string | null = null;
  let currentLeagueId = "";

  for (let si = 0; si < total; si++) {
    const year = first + si;
    const leagueId = String(900000000000000000n + BigInt(year) * 1000n);
    const complete = si < total - 1;
    const roster = MANAGERS.slice(0, nTeams).map((m, i) =>
      i === nTeams - 1 && si >= 2 ? NEWCOMER : m,
    );
    const users: SleeperUser[] = roster.map(([name, team], i) => ({
      // Riley switched Sleeper accounts in season 4: exercises the config identity map.
      user_id: name === "Riley" && si >= 3 ? "u_riley_new" : `u_${name.toLowerCase()}`,
      username: name.toLowerCase(),
      display_name: name,
      avatar: null,
      is_owner: i === 0,
      metadata: { team_name: si % 3 === 2 && i % 4 === 1 ? `${team} II` : team },
    }));
    const skill = roster.map(([, , s]) => s + normal(0, 4));

    const playoffStart = 15;
    const regWeeks = playoffStart - 1;
    const lastWeek = playoffStart + 2;
    const weeksPlayed = complete ? lastWeek : currentWeek;

    // Rosters of players: 9 starters + 6 bench per team
    const teamPlayers = roster.map((_, ti) =>
      Array.from({ length: 15 }, (_, k) => players[(ti * 15 + k + si * 7) % players.length]!),
    );

    // Round-robin schedule (circle method)
    const ids = Array.from({ length: nTeams }, (_, i) => i + 1);
    const schedule: [number, number][][] = [];
    for (let w = 0; w < regWeeks; w++) {
      const rot = [ids[0]!, ...ids.slice(1).map((_, k) => ids[1 + ((k + w) % (nTeams - 1))]!)];
      const pairs: [number, number][] = [];
      for (let k = 0; k < nTeams / 2; k++) pairs.push([rot[k]!, rot[nTeams - 1 - k]!]);
      schedule.push(pairs);
    }

    const score = (rid: number) => Math.max(42, normal(skill[rid - 1]!, 19));
    const matchupRow = (rid: number, mid: number | null, pts: number): SleeperMatchup => {
      const tp = teamPlayers[rid - 1]!;
      const starters = tp.slice(0, 9).map((p) => p.id);
      // spread team points over starters proportionally to base
      const baseSum = tp.slice(0, 9).reduce((n, p) => n + p.base, 0);
      const pp: Record<string, number> = {};
      tp.slice(0, 9).forEach((p) => (pp[p.id] = r2((pts * p.base) / baseSum)));
      tp.slice(9).forEach((p) => (pp[p.id] = r2(Math.max(0, normal(p.base, 6)))));
      return {
        roster_id: rid,
        matchup_id: mid,
        points: r2(pts),
        custom_points: null,
        starters,
        players: tp.map((p) => p.id),
        players_points: pp,
        starters_points: starters.map((s) => pp[s]!),
      };
    };

    const matchups: SleeperMatchup[][] = [];
    const rec = ids.map(() => ({ w: 0, l: 0, t: 0, pf: 0, pa: 0 }));
    for (let w = 1; w <= Math.min(weeksPlayed, regWeeks); w++) {
      const rows: SleeperMatchup[] = [];
      schedule[w - 1]!.forEach(([a, b], k) => {
        const pa = score(a);
        const pb = score(b);
        rows.push(matchupRow(a, k + 1, pa), matchupRow(b, k + 1, pb));
        const A = rec[a - 1]!, B = rec[b - 1]!;
        A.pf += pa; A.pa += pb; B.pf += pb; B.pa += pa;
        if (pa > pb) { A.w++; B.l++; } else if (pb > pa) { B.w++; A.l++; } else { A.t++; B.t++; }
      });
      matchups.push(rows);
    }

    let winners: SleeperBracketMatch[] = [];
    let losers: SleeperBracketMatch[] = [];
    if (complete) {
      const seeds = [...ids].sort(
        (x, y) => rec[y - 1]!.w - rec[x - 1]!.w || rec[y - 1]!.pf - rec[x - 1]!.pf,
      );
      const play = (week: number, pairs: [number, number][], mids: number[]) => {
        const rows = matchups[week - 1] ?? (matchups[week - 1] = []);
        return pairs.map(([a, b], k) => {
          const pa = score(a);
          const pb = score(b);
          rows.push(matchupRow(a, mids[k]!, pa), matchupRow(b, mids[k]!, pb));
          return pa >= pb ? { w: a, l: b } : { w: b, l: a };
        });
      };
      const runBracket = (s: number[], midBase: number) => {
        const [s1, s2, s3, s4, s5, s6] = s as [number, number, number, number, number, number];
        const [m1, m2] = play(playoffStart, [[s3, s6], [s4, s5]], [midBase + 1, midBase + 2]);
        const [m3, m4, m5] = play(playoffStart + 1, [[s1, m1!.w], [s2, m2!.w], [m1!.l, m2!.l]], [midBase + 1, midBase + 2, midBase + 3]);
        const [m6, m7] = play(playoffStart + 2, [[m3!.w, m4!.w], [m3!.l, m4!.l]], [midBase + 1, midBase + 2]);
        return [
          { r: 1, m: 1, t1: s3, t2: s6, w: m1!.w, l: m1!.l },
          { r: 1, m: 2, t1: s4, t2: s5, w: m2!.w, l: m2!.l },
          { r: 2, m: 3, t1: s1, t2: m1!.w, t2_from: { w: 1 }, w: m3!.w, l: m3!.l },
          { r: 2, m: 4, t1: s2, t2: m2!.w, t2_from: { w: 2 }, w: m4!.w, l: m4!.l },
          { r: 2, m: 5, t1: m1!.l, t2: m2!.l, t1_from: { l: 1 }, t2_from: { l: 2 }, w: m5!.w, l: m5!.l, p: 5 },
          { r: 3, m: 6, t1: m3!.w, t2: m4!.w, t1_from: { w: 3 }, t2_from: { w: 4 }, w: m6!.w, l: m6!.l, p: 1 },
          { r: 3, m: 7, t1: m3!.l, t2: m4!.l, t1_from: { l: 3 }, t2_from: { l: 4 }, w: m7!.w, l: m7!.l, p: 3 },
        ] satisfies SleeperBracketMatch[];
      };
      winners = runBracket(seeds.slice(0, 6), 0);
      losers = runBracket(seeds.slice(6, 12), 10);
    }

    const rosters: SleeperRoster[] = ids.map((rid) => {
      const r = rec[rid - 1]!;
      return {
        roster_id: rid,
        owner_id: users[rid - 1]!.user_id,
        players: teamPlayers[rid - 1]!.map((p) => p.id),
        starters: teamPlayers[rid - 1]!.slice(0, 9).map((p) => p.id),
        settings: {
          wins: r.w, losses: r.l, ties: r.t,
          fpts: Math.floor(r.pf), fpts_decimal: Math.round((r.pf % 1) * 100),
          fpts_against: Math.floor(r.pa), fpts_against_decimal: Math.round((r.pa % 1) * 100),
        },
      };
    });

    // Transactions: a few waiver adds per week, an occasional trade
    const transactions: SleeperTransaction[][] = [];
    for (let w = 1; w <= weeksPlayed; w++) {
      const list: SleeperTransaction[] = [];
      const n = Math.floor(rand() * 5);
      for (let k = 0; k < n; k++) {
        const rid = 1 + Math.floor(rand() * nTeams);
        const add = players[Math.floor(rand() * players.length)]!.id;
        const drop = teamPlayers[rid - 1]![14]!.id;
        list.push({
          transaction_id: `${year}${w}${k}`,
          type: rand() < 0.6 ? "waiver" : "free_agent",
          status: "complete",
          leg: w,
          created: Date.UTC(year, 8, 7 + w * 7),
          roster_ids: [rid],
          adds: { [add]: rid },
          drops: { [drop]: rid },
          draft_picks: [],
          waiver_budget: [],
          settings: { waiver_bid: Math.floor(rand() * 40) },
        });
      }
      if (rand() < 0.25) {
        const a = 1 + Math.floor(rand() * nTeams);
        const b = (a % nTeams) + 1;
        const pa = teamPlayers[a - 1]![3]!.id;
        const pb = teamPlayers[b - 1]![4]!.id;
        list.push({
          transaction_id: `${year}${w}t`,
          type: "trade", status: "complete", leg: w, created: Date.UTC(year, 8, 8 + w * 7),
          roster_ids: [a, b], adds: { [pa]: b, [pb]: a }, drops: { [pa]: a, [pb]: b },
          draft_picks: [], waiver_budget: [],
        });
      }
      transactions.push(list);
    }

    const draftId = `${leagueId}d`;
    const picks: SleeperDraftPick[] = [];
    for (let round = 1; round <= 15; round++) {
      for (let slot = 1; slot <= nTeams; slot++) {
        const rid = round % 2 ? slot : nTeams + 1 - slot;
        const p = teamPlayers[rid - 1]![round - 1]!;
        picks.push({
          player_id: p.id, picked_by: users[rid - 1]!.user_id, roster_id: rid,
          round, draft_slot: slot, pick_no: (round - 1) * nTeams + slot,
          metadata: { first_name: p.first, last_name: p.last, position: p.pos, team: "FA" },
        });
      }
    }

    const league: SleeperLeague = {
      league_id: leagueId,
      previous_league_id: prevId,
      name: "The Gridiron Syndicate",
      season: String(year),
      status: complete ? "complete" : "in_season",
      total_rosters: nTeams,
      draft_id: draftId,
      avatar: null,
      settings: { playoff_week_start: playoffStart, playoff_teams: 6, ...(complete ? {} : { last_scored_leg: currentWeek - 1 }) },
      scoring_settings: { rec: 0.5, pass_td: 4, rush_td: 6, rec_td: 6 },
      roster_positions: POSITIONS,
    };

    leagues.set(leagueId, {
      league, users, rosters, matchups, winners, losers, transactions,
      drafts: [{ draft_id: draftId, season: String(year), type: "snake", status: "complete", start_time: Date.UTC(year, 8, 1), settings: { rounds: 15, teams: nTeams } }],
      picks: { [draftId]: picks },
    });
    prevId = leagueId;
    currentLeagueId = leagueId;
  }

  return {
    currentLeagueId,
    state: { season: String(first + total - 1), season_type: "regular", week: currentWeek, display_week: currentWeek },
    leagues,
  };
}

/** Serves fixture data at the same paths as the real API. */
export class FixtureTransport implements SleeperTransport {
  constructor(readonly data: FixtureData = generateFixtureLeague()) {}

  async get<T>(path: string): Promise<T> {
    const parts = path.split("/").filter(Boolean);
    const d = this.data;
    const json = (x: unknown) => structuredClone(x) as T;
    if (parts[0] === "state") return json(d.state);
    if (parts[0] === "draft") {
      for (const l of d.leagues.values()) if (l.picks[parts[1]!]) return json(l.picks[parts[1]!]);
      throw new Error(`fixture: unknown draft ${parts[1]}`);
    }
    if (parts[0] === "league") {
      const l = d.leagues.get(parts[1]!);
      if (!l) throw new Error(`fixture: unknown league ${parts[1]}`);
      const week = Number(parts[3]);
      switch (parts[2]) {
        case undefined: return json(l.league);
        case "users": return json(l.users);
        case "rosters": return json(l.rosters);
        case "matchups": return json(l.matchups[week - 1] ?? []);
        case "transactions": return json(l.transactions[week - 1] ?? []);
        case "winners_bracket": return json(l.winners);
        case "losers_bracket": return json(l.losers);
        case "drafts": return json(l.drafts);
      }
    }
    throw new Error(`fixture: unhandled path ${path}`);
  }
}

/** The config that pairs with the fixture league (Riley's two accounts). */
export const FIXTURE_CONFIG = {
  leagueId: "fixture",
  name: "The Gridiron Syndicate",
  managers: [{ id: "riley", name: "Riley", userIds: ["u_riley", "u_riley_new"] }],
  trophies: { champion: "The Syndicate Cup", last: "The Wooden Spoon" },
  lastPlaceRule: "regularSeason" as const,
};
