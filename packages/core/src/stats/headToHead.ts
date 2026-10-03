import { round2 } from "../model/normalize";
import { defineStat } from "./context";

export interface HeadToHeadLine {
  managerId: string;
  opponentId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  playoffMeetings: number;
  /** e.g. "W3": current streak from managerId's perspective. */
  streak: string;
  biggestWin?: { gameId: string; margin: number };
  lastMeeting?: { gameId: string; season: number; week: number };
}

/** h2h[a][b] = a's record against b, all game kinds included. */
export const headToHead = defineStat({
  id: "headToHead",
  title: "Head-to-head",
  description: "Every manager's record against every other manager.",
  compute(ctx) {
    const out: Record<string, Record<string, HeadToHeadLine>> = {};
    const ordered = [...ctx.perspectives].sort(
      (a, b) => a.game.season - b.game.season || a.game.week - b.game.week,
    );
    for (const p of ordered) {
      const row = (out[p.managerId] ??= {});
      const l = (row[p.opponentId] ??= {
        managerId: p.managerId,
        opponentId: p.opponentId,
        wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, playoffMeetings: 0, streak: "",
      });
      if (p.result === "W") l.wins++;
      else if (p.result === "L") l.losses++;
      else l.ties++;
      l.pointsFor = round2(l.pointsFor + p.pf);
      l.pointsAgainst = round2(l.pointsAgainst + p.pa);
      if (p.game.kind === "playoff") l.playoffMeetings++;
      const margin = round2(p.pf - p.pa);
      if (p.result === "W" && (!l.biggestWin || margin > l.biggestWin.margin)) {
        l.biggestWin = { gameId: p.game.id, margin };
      }
      const prev = l.streak;
      l.streak = prev.startsWith(p.result) ? `${p.result}${Number(prev.slice(1)) + 1}` : `${p.result}1`;
      l.lastMeeting = { gameId: p.game.id, season: p.game.season, week: p.game.week };
    }
    return out;
  },
});
