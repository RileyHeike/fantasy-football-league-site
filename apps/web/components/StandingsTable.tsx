import { formatPoints, type SeasonStanding } from "@league/core";
import { ManagerName, Rec, Table, td, tdNum, th, thNum, Trophy } from "./ui";
import { teamName } from "@/lib/data";

const FINISH: Record<NonNullable<SeasonStanding["finish"]>, string> = {
  champion: "Champion",
  runnerUp: "Runner-up",
  third: "Third",
  last: "Last place",
};

export function StandingsTable({ lines, year, compact }: { lines: SeasonStanding[]; year: number; compact?: boolean }) {
  return (
    <Table caption={`${year} standings`}>
      <thead>
        <tr>
          <th className={thNum}>#</th>
          <th className={th}>Manager</th>
          <th className={thNum}>Record</th>
          <th className={thNum}>PF</th>
          {!compact && <th className={thNum}>PA</th>}
          {!compact && <th className={th}>Finish</th>}
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.managerId} className="hover:bg-field-sunk">
            <td className={`${tdNum} text-chalk-dim`}>{l.rank}</td>
            <td className={td}><ManagerName id={l.managerId} sub={compact ? undefined : teamName(l.managerId, year)} /></td>
            <td className={tdNum}><Rec w={l.wins} l={l.losses} t={l.ties} /></td>
            <td className={tdNum}>{formatPoints(l.pointsFor)}</td>
            {!compact && <td className={tdNum}>{formatPoints(l.pointsAgainst)}</td>}
            {!compact && (
              <td className={td}>
                {l.finish === "champion" ? <Trophy /> : l.finish ? <span className={l.finish === "last" ? "text-loss" : ""}>{FINISH[l.finish]}</span>
                  : l.madePlayoffs ? <span className="text-chalk-dim">Playoffs</span> : null}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
