import type { RawSeason } from "../sleeper/history";
import { lastWeekOf } from "../sleeper/history";
import type { SleeperBracketMatch, SleeperMatchup, SleeperPlayer, SleeperUser } from "../sleeper/types";
import type {
  DraftPick,
  Game,
  GameKind,
  GameSide,
  LeagueConfig,
  LeagueHistory,
  Manager,
  PlayerInfo,
  Season,
  SeasonPlacements,
  SeasonTeam,
  Transaction,
} from "./types";

export interface NormalizeOptions {
  config?: LeagueConfig;
  /** Optional Sleeper players map (from /players/nfl) to name every player. */
  players?: Record<string, SleeperPlayer>;
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-") || "manager"
  );
}

export function normalize(raw: RawSeason[], opts: NormalizeOptions = {}): LeagueHistory {
  const config = opts.config;
  const seasonsRaw = [...raw].sort((a, b) => Number(a.league.season) - Number(b.league.season));
  const managers = new ManagerRegistry(config);

  const seasons: Season[] = [];
  const games: Game[] = [];
  const transactions: Transaction[] = [];
  const draftPicks: DraftPick[] = [];
  const players: Record<string, PlayerInfo> = {};

  for (const rs of seasonsRaw) {
    const year = Number(rs.league.season);
    const usersById = new Map(rs.users.map((u) => [u.user_id, u]));

    // roster_id -> managerId for this season
    const rosterToManager = new Map<number, string>();
    const teams: SeasonTeam[] = [];
    for (const roster of [...rs.rosters].sort((a, b) => a.roster_id - b.roster_id)) {
      const user = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
      const teamName = user?.metadata?.team_name || user?.display_name || `Team ${roster.roster_id}`;
      const managerId = managers.resolve(user, roster.owner_id, roster.roster_id, year, teamName);
      rosterToManager.set(roster.roster_id, managerId);
      teams.push({ managerId, rosterId: roster.roster_id, teamName });
    }
    const m = (rosterId: number | null | undefined) =>
      rosterId == null ? undefined : rosterToManager.get(rosterId);

    const regularSeasonWeeks = (rs.league.settings.playoff_week_start ?? 15) - 1;
    const playoffStart = regularSeasonWeeks + 1;
    const lastScored =
      typeof rs.league.settings.last_scored_leg === "number"
        ? rs.league.settings.last_scored_leg
        : rs.league.status === "complete"
          ? Infinity
          : rs.matchups.length - 1;

    const winnersKeys = bracketIndex(rs.winnersBracket, playoffStart);
    const losersKeys = bracketIndex(rs.losersBracket, playoffStart);

    rs.matchups.forEach((weekMatchups, i) => {
      const week = i + 1;
      for (const [a, b] of pairMatchups(weekMatchups)) {
        const ma = m(a.roster_id);
        const mb = m(b.roster_id);
        if (!ma || !mb) continue;
        let kind: GameKind = "regular";
        let placement: number | undefined;
        if (week > regularSeasonWeeks) {
          const key = pairKey(week, a.roster_id, b.roster_id);
          const w = winnersKeys.get(key);
          const l = losersKeys.get(key);
          if (w) {
            kind = "playoff";
            placement = w.p;
          } else {
            kind = "consolation";
            placement = l?.p;
          }
        }
        const home = side(ma, a);
        const away = side(mb, b);
        const final = week <= lastScored;
        games.push({
          id: `${year}-w${week}-${a.roster_id}v${b.roster_id}`,
          season: year,
          week,
          kind,
          placement,
          home,
          away,
          winnerId: !final || home.points === away.points ? null : home.points > away.points ? ma : mb,
          final,
        });
      }
    });

    const placements = computePlacements(rs, m, games.filter((g) => g.season === year), config);

    seasons.push({
      year,
      leagueId: rs.league.league_id,
      name: rs.league.name,
      status: rs.league.status,
      regularSeasonWeeks,
      playoffTeams: rs.league.settings.playoff_teams ?? 6,
      lastWeek: lastWeekOf(rs.league),
      teams,
      placements,
    });

    for (const tx of rs.transactions) {
      if (tx.status !== "complete") continue;
      const mapSide = (rec: Record<string, number> | null) =>
        Object.entries(rec ?? {}).flatMap(([playerId, rid]) => {
          const managerId = m(rid);
          return managerId ? [{ playerId, managerId }] : [];
        });
      transactions.push({
        id: tx.transaction_id,
        season: year,
        week: tx.leg,
        type: tx.type,
        created: tx.created,
        managerIds: tx.roster_ids.map((r) => m(r)).filter((x): x is string => !!x),
        adds: mapSide(tx.adds),
        drops: mapSide(tx.drops),
        faabBid: tx.settings?.waiver_bid ?? undefined,
      });
    }

    for (const { picks } of rs.drafts) {
      for (const p of picks) {
        const managerId = m(Number(p.roster_id)) ?? managers.byUserId(p.picked_by);
        if (!managerId) continue;
        draftPicks.push({ season: year, round: p.round, pickNo: p.pick_no, managerId, playerId: p.player_id });
        const name = [p.metadata.first_name, p.metadata.last_name].filter(Boolean).join(" ");
        if (name) players[p.player_id] = { name, position: p.metadata.position, team: p.metadata.team ?? null };
      }
    }
  }

  for (const [id, pl] of Object.entries(opts.players ?? {})) {
    const name = pl.full_name ?? [pl.first_name, pl.last_name].filter(Boolean).join(" ");
    if (name) players[id] = { name, position: pl.position, team: pl.team ?? null };
  }

  const leagueName = config?.name ?? seasonsRaw.at(-1)?.league.name ?? "League";
  return { leagueName, managers: managers.list(), seasons, games, transactions, draftPicks, players };
}

function side(managerId: string, mu: SleeperMatchup): GameSide {
  const points = round2(mu.custom_points ?? mu.points ?? 0);
  const pp = mu.players_points;
  if (!pp) return { managerId, points };
  const starterSet = new Set(mu.starters);
  return {
    managerId,
    points,
    starters: mu.starters.filter((p) => p !== "0").map((playerId) => ({ playerId, points: pp[playerId] ?? 0 })),
    bench: mu.players.filter((p) => !starterSet.has(p)).map((playerId) => ({ playerId, points: pp[playerId] ?? 0 })),
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Group a week's matchup rows into head-to-head pairs by matchup_id. */
export function pairMatchups(rows: SleeperMatchup[]): [SleeperMatchup, SleeperMatchup][] {
  const byId = new Map<number, SleeperMatchup[]>();
  for (const r of rows) {
    if (r.matchup_id == null) continue;
    const list = byId.get(r.matchup_id) ?? [];
    list.push(r);
    byId.set(r.matchup_id, list);
  }
  const pairs: [SleeperMatchup, SleeperMatchup][] = [];
  for (const [, list] of [...byId.entries()].sort((x, y) => x[0] - y[0])) {
    if (list.length === 2) {
      const [a, b] = list.sort((x, y) => x.roster_id - y.roster_id) as [SleeperMatchup, SleeperMatchup];
      pairs.push([a, b]);
    }
  }
  return pairs;
}

const pairKey = (week: number, r1: number, r2: number) =>
  `${week}:${Math.min(r1, r2)}-${Math.max(r1, r2)}`;

function bracketIndex(bracket: SleeperBracketMatch[], playoffStart: number) {
  const idx = new Map<string, SleeperBracketMatch>();
  for (const b of bracket) {
    if (b.t1 == null || b.t2 == null) continue;
    idx.set(pairKey(playoffStart + b.r - 1, b.t1, b.t2), b);
  }
  return idx;
}

function computePlacements(
  rs: RawSeason,
  m: (r: number | null | undefined) => string | undefined,
  seasonGames: Game[],
  config?: LeagueConfig,
): SeasonPlacements {
  if (rs.league.status !== "complete") return {};
  const final = rs.winnersBracket.find((b) => b.p === 1);
  const third = rs.winnersBracket.find((b) => b.p === 3);
  const consolationFinal = rs.losersBracket.find((b) => b.p === 1);
  const rule = config?.lastPlaceRule ?? "regularSeason";

  let last: string | undefined;
  if (rule === "consolationFinalLoser") last = m(consolationFinal?.l);
  else if (rule === "consolationFinalWinner") last = m(consolationFinal?.w);
  else {
    const rec = new Map<string, { w: number; pf: number }>();
    for (const g of seasonGames) {
      if (g.kind !== "regular" || !g.final) continue;
      for (const s of [g.home, g.away]) {
        const r = rec.get(s.managerId) ?? { w: 0, pf: 0 };
        r.pf += s.points;
        if (g.winnerId === s.managerId) r.w += 1;
        else if (g.winnerId === null) r.w += 0.5;
        rec.set(s.managerId, r);
      }
    }
    last = [...rec.entries()].sort((a, b) => a[1].w - b[1].w || a[1].pf - b[1].pf)[0]?.[0];
  }

  return { champion: m(final?.w), runnerUp: m(final?.l), third: m(third?.w), last };
}

/** Maps Sleeper accounts to permanent managers, honoring the config overrides. */
class ManagerRegistry {
  private readonly managers = new Map<string, Manager>();
  private readonly userToManager = new Map<string, string>();

  constructor(config?: LeagueConfig) {
    for (const c of config?.managers ?? []) {
      this.managers.set(c.id, {
        id: c.id,
        name: c.name,
        avatar: null,
        userIds: [...c.userIds],
        colorIndex: 0,
        teamNames: [],
        firstSeason: Infinity,
        lastSeason: -Infinity,
      });
      for (const u of c.userIds) this.userToManager.set(u, c.id);
    }
  }

  byUserId(userId: string) {
    return this.userToManager.get(userId);
  }

  resolve(
    user: SleeperUser | undefined,
    ownerId: string | null,
    rosterId: number,
    year: number,
    teamName: string,
  ): string {
    let id = ownerId ? this.userToManager.get(ownerId) : undefined;
    if (!id) {
      const base = user ? slugify(user.display_name) : `vacant-${rosterId}`;
      id = base;
      for (let n = 2; this.managers.has(id) && !this.managers.get(id)!.userIds.includes(ownerId ?? ""); n++) {
        id = `${base}-${n}`;
      }
      if (!this.managers.has(id)) {
        this.managers.set(id, {
          id,
          name: user?.display_name ?? `Vacant team ${rosterId}`,
          avatar: null,
          userIds: [],
          colorIndex: 0,
          teamNames: [],
          firstSeason: Infinity,
          lastSeason: -Infinity,
        });
      }
      if (ownerId) {
        this.userToManager.set(ownerId, id);
        const mgr = this.managers.get(id)!;
        if (!mgr.userIds.includes(ownerId)) mgr.userIds.push(ownerId);
      }
    }
    const mgr = this.managers.get(id)!;
    if (user?.avatar) mgr.avatar = user.avatar;
    if (mgr.teamNames.at(-1) !== teamName) mgr.teamNames.push(teamName);
    mgr.firstSeason = Math.min(mgr.firstSeason, year);
    mgr.lastSeason = Math.max(mgr.lastSeason, year);
    return id;
  }

  list(): Manager[] {
    const active = [...this.managers.values()].filter((m) => Number.isFinite(m.firstSeason));
    active.sort((a, b) => a.firstSeason - b.firstSeason || a.name.localeCompare(b.name));
    active.forEach((m, i) => (m.colorIndex = i));
    return active;
  }
}
