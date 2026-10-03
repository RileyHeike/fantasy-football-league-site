import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  LeagueSnapshot,
  PlayerStatsStore,
  PlayerWeeklyStore,
  RawSeason,
  RawSeasonStore,
  SleeperPlayerStatLine,
  SnapshotStore,
} from "@league/core";

/** Local storage: data/raw/<season>.json and data/snapshot.json. */
export class FileRawStore implements RawSeasonStore {
  constructor(private readonly dir: string) {}
  async loadAll(): Promise<RawSeason[]> {
    try {
      const files = (await readdir(this.dir)).filter((f) => f.endsWith(".json"));
      return Promise.all(files.map(async (f) => JSON.parse(await readFile(join(this.dir, f), "utf8"))));
    } catch {
      return [];
    }
  }
  async save(s: RawSeason) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, `${s.league.season}.json`), JSON.stringify(s));
  }
}

export class FileSnapshotStore implements SnapshotStore {
  constructor(private readonly path: string) {}
  async load() {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as LeagueSnapshot;
    } catch {
      return null;
    }
  }
  async save(s: LeagueSnapshot) {
    await mkdir(join(this.path, ".."), { recursive: true });
    await writeFile(this.path, JSON.stringify(s));
  }
}

/** Local storage: data/playerStats/<season>.json. */
export class FilePlayerStatsStore implements PlayerStatsStore {
  constructor(private readonly dir: string) {}
  async loadAll(): Promise<Record<number, SleeperPlayerStatLine[]>> {
    try {
      const files = (await readdir(this.dir)).filter((f) => f.endsWith(".json"));
      const out: Record<number, SleeperPlayerStatLine[]> = {};
      for (const f of files) out[Number(f.replace(".json", ""))] = JSON.parse(await readFile(join(this.dir, f), "utf8"));
      return out;
    } catch {
      return {};
    }
  }
  async save(season: number, lines: SleeperPlayerStatLine[]) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, `${season}.json`), JSON.stringify(lines));
  }
}

/** Local storage: data/playerWeekly/<playerId>-<season>.json. */
export class FilePlayerWeeklyStore implements PlayerWeeklyStore {
  constructor(private readonly dir: string) {}
  async loadAll(): Promise<Record<string, Record<string, SleeperPlayerStatLine>>> {
    try {
      const files = (await readdir(this.dir)).filter((f) => f.endsWith(".json"));
      const out: Record<string, Record<string, SleeperPlayerStatLine>> = {};
      for (const f of files) out[f.replace(".json", "")] = JSON.parse(await readFile(join(this.dir, f), "utf8"));
      return out;
    } catch {
      return {};
    }
  }
  async save(playerId: string, season: number, weeks: Record<string, SleeperPlayerStatLine>) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, `${playerId}-${season}.json`), JSON.stringify(weeks));
  }
}
