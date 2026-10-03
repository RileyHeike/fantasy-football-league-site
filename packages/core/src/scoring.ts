import { round2 } from "./model/normalize";

/**
 * Turns a raw Sleeper stat line into fantasy points under a specific
 * league's own scoring settings — a plain dot product over whichever
 * categories that league actually scores. Never use the stats API's own
 * pts_std/half_ppr/ppr fields instead of this: they assume a fixed format
 * (verified against this league's real recorded points, e.g. kicker scoring
 * by exact field-goal distance isn't any of the three standard buckets) and
 * silently produce the wrong number for a league with custom settings.
 */
export function scorePoints(stats: Record<string, number>, scoringSettings: Record<string, number>): number {
  let total = 0;
  for (const [category, weight] of Object.entries(scoringSettings)) {
    const value = stats[category];
    if (value) total += weight * value;
  }
  return round2(total);
}
