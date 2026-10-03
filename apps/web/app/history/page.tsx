import Link from "next/link";
import { ManagerName, PageTitle, Table, td, th } from "@/components/ui";
import { seasons } from "@/lib/data";

export const metadata = { title: "History" };

export default function History() {
  return (
    <>
      <PageTitle sub="Every season since the league moved to Sleeper.">History</PageTitle>
      <Table caption="Seasons">
        <thead>
          <tr>
            <th className={th}>Season</th>
            <th className={th}>Champion</th>
            <th className={th}>Runner-up</th>
            <th className={th}>Last place</th>
          </tr>
        </thead>
        <tbody>
          {seasons().map((s) => (
            <tr key={s.year} className="hover:bg-field-sunk">
              <td className={td}>
                <Link href={`/history/${s.year}/`} className="font-display text-2xl font-bold hover:underline">{s.year}</Link>
                {s.status !== "complete" && <span className="ml-2 text-sm text-chalk-dim">In progress</span>}
              </td>
              <td className={td}>{s.placements.champion ? <ManagerName id={s.placements.champion} /> : <span className="text-chalk-dim">To be decided</span>}</td>
              <td className={td}>{s.placements.runnerUp && <ManagerName id={s.placements.runnerUp} />}</td>
              <td className={td}>{s.placements.last && <ManagerName id={s.placements.last} />}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
