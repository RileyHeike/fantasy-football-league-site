import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertSnapshot, type Game, type LeagueSnapshot, type Manager, type Season } from "@league/core";

/**
 * Build-time data access. Pages are statically rendered, so the snapshot is
 * read once per build and never shipped whole to the browser.
 */
let cached: LeagueSnapshot | null = null;

export function snapshot(): LeagueSnapshot {
  if (cached) return cached;
  const path = process.env.SNAPSHOT_PATH ?? join(process.cwd(), "../../data/snapshot.json");
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`No league snapshot at ${path}. Run "npm run sync:fixture" (demo) or "npm run sync" first.`);
  }
  assertSnapshot(json);
  cached = json;
  return json;
}

export const league = () => snapshot().league;
export const stats = () => snapshot().stats;

export function manager(id: string): Manager {
  const m = league().managers.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown manager ${id}`);
  return m;
}

export const seasons = (): Season[] => [...league().seasons].sort((a, b) => b.year - a.year);
export const season = (year: number) => league().seasons.find((s) => s.year === year);
export const currentSeason = (): Season => seasons()[0]!;
export const completedSeasons = () => seasons().filter((s) => s.status === "complete");

/** Team name a manager used in a given season. */
export function teamName(managerId: string, year: number): string {
  return season(year)?.teams.find((t) => t.managerId === managerId)?.teamName ?? manager(managerId).name;
}

export function gamesFor(year: number, week?: number): Game[] {
  return league().games.filter((g) => g.season === year && (week === undefined || g.week === week));
}

export function playerName(id: string): string {
  return league().players[id]?.name ?? (/^[A-Z]{2,3}$/.test(id) ? `${id} D/ST` : `Player ${id}`);
}
