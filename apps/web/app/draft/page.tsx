import Link from "next/link";
import { PageTitle, Table, td, tdNum, th, thNum } from "@/components/ui";
import { draftPicksFor, seasons } from "@/lib/data";

export const metadata = { title: "Draft boards" };

export default function Draft() {
  return (
    <>
      <PageTitle sub="Every pick, every season.">Draft boards</PageTitle>
      <Table caption="Seasons">
        <thead>
          <tr>
            <th className={th}>Season</th>
            <th className={thNum}>Picks</th>
          </tr>
        </thead>
        <tbody>
          {seasons().map((s) => {
            const count = draftPicksFor(s.year).length;
            return (
              <tr key={s.year} className="hover:bg-field-sunk">
                <td className={td}>
                  {count > 0 ? (
                    <Link href={`/draft/${s.year}/`} className="font-display text-2xl font-bold hover:underline">{s.year}</Link>
                  ) : (
                    <span className="font-display text-2xl font-bold text-chalk-dim">{s.year}</span>
                  )}
                </td>
                <td className={tdNum}>{count || <span className="text-chalk-dim">Not recorded</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
