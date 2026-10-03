import type {
  SleeperBracketMatch,
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperMatchup,
  SleeperNflState,
  SleeperPlayer,
  SleeperRoster,
  SleeperTransaction,
  SleeperUser,
} from "./types";

/**
 * A transport turns an API path ("/league/123/rosters") into parsed JSON.
 * Swapping the transport is how tests and offline development work: the
 * fixture transport serves a generated league with the exact same shapes.
 */
export interface SleeperTransport {
  get<T>(path: string): Promise<T>;
}

export const SLEEPER_BASE_URL = "https://api.sleeper.app/v1";

export interface HttpTransportOptions {
  baseUrl?: string;
  /** Minimum gap between requests. Sleeper asks for < 1000 calls/minute. */
  minIntervalMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
}

export class HttpTransport implements SleeperTransport {
  private readonly baseUrl: string;
  private readonly minIntervalMs: number;
  private readonly retries: number;
  private readonly fetchImpl: typeof fetch;
  private last = 0;

  constructor(opts: HttpTransportOptions = {}) {
    this.baseUrl = opts.baseUrl ?? SLEEPER_BASE_URL;
    this.minIntervalMs = opts.minIntervalMs ?? 100; // ~600/min ceiling
    this.retries = opts.retries ?? 3;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async get<T>(path: string): Promise<T> {
    let attempt = 0;
    for (;;) {
      await this.throttle();
      const res = await this.fetchImpl(`${this.baseUrl}${path}`);
      if (res.ok) return (await res.json()) as T;
      const retriable = res.status === 429 || res.status >= 500;
      if (!retriable || attempt >= this.retries) {
        throw new SleeperApiError(path, res.status);
      }
      attempt += 1;
      await sleep(500 * 2 ** attempt);
    }
  }

  private async throttle() {
    const wait = this.last + this.minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.last = Date.now();
  }
}

export class SleeperApiError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
  ) {
    super(`Sleeper API ${status} for ${path}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Typed, endpoint-per-method wrapper. No caching or logic lives here. */
export class SleeperClient {
  constructor(private readonly t: SleeperTransport = new HttpTransport()) {}

  nflState() {
    return this.t.get<SleeperNflState>("/state/nfl");
  }
  league(id: string) {
    return this.t.get<SleeperLeague>(`/league/${id}`);
  }
  users(id: string) {
    return this.t.get<SleeperUser[]>(`/league/${id}/users`);
  }
  rosters(id: string) {
    return this.t.get<SleeperRoster[]>(`/league/${id}/rosters`);
  }
  matchups(id: string, week: number) {
    return this.t.get<SleeperMatchup[]>(`/league/${id}/matchups/${week}`);
  }
  winnersBracket(id: string) {
    return this.t.get<SleeperBracketMatch[]>(`/league/${id}/winners_bracket`);
  }
  losersBracket(id: string) {
    return this.t.get<SleeperBracketMatch[]>(`/league/${id}/losers_bracket`);
  }
  transactions(id: string, week: number) {
    return this.t.get<SleeperTransaction[]>(`/league/${id}/transactions/${week}`);
  }
  drafts(id: string) {
    return this.t.get<SleeperDraft[]>(`/league/${id}/drafts`);
  }
  draftPicks(draftId: string) {
    return this.t.get<SleeperDraftPick[]>(`/draft/${draftId}/picks`);
  }
  /** Every NFL player Sleeper knows about, keyed by id. Several MB — Sleeper asks this be fetched sparingly (about once a day). */
  players() {
    return this.t.get<Record<string, SleeperPlayer>>("/players/nfl");
  }
}
