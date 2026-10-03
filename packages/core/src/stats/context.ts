import type { Game, LeagueHistory, Manager, Season } from "../model/types";

/**
 * Shared, memoized views over the league that stat modules reuse, so every
 * module doesn't re-filter thousands of games.
 */
export class StatContext {
  readonly managerById: Map<string, Manager>;
  readonly seasonByYear: Map<number, Season>;
  readonly finalGames: Game[];
  readonly regularGames: Game[];
  readonly playoffGames: Game[];

  constructor(readonly league: LeagueHistory) {
    this.managerById = new Map(league.managers.map((m) => [m.id, m]));
    this.seasonByYear = new Map(league.seasons.map((s) => [s.year, s]));
    this.finalGames = league.games.filter((g) => g.final);
    this.regularGames = this.finalGames.filter((g) => g.kind === "regular");
    this.playoffGames = this.finalGames.filter((g) => g.kind === "playoff");
  }

  /** Each final game seen from both sides: one row per manager per game. */
  get perspectives(): Perspective[] {
    return (this._persp ??= this.finalGames.flatMap((g) => [
      perspective(g, "home"),
      perspective(g, "away"),
    ]));
  }
  private _persp?: Perspective[];
}

export interface Perspective {
  game: Game;
  managerId: string;
  opponentId: string;
  pf: number;
  pa: number;
  result: "W" | "L" | "T";
}

function perspective(g: Game, s: "home" | "away"): Perspective {
  const me = g[s];
  const opp = s === "home" ? g.away : g.home;
  return {
    game: g,
    managerId: me.managerId,
    opponentId: opp.managerId,
    pf: me.points,
    pa: opp.points,
    result: g.winnerId === null ? "T" : g.winnerId === me.managerId ? "W" : "L",
  };
}

export interface StatModule<T> {
  id: string;
  title: string;
  description: string;
  compute(ctx: StatContext): T;
}

export const defineStat = <T>(m: StatModule<T>) => m;
