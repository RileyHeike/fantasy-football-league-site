import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LeagueSnapshot, RawSeason, RawSeasonStore, SnapshotStore } from "@league/core";

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
