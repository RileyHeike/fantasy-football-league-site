import Link from "next/link";
import { PageTitle, Table, td, tdNum, th, thNum } from "@/components/ui";
import { seasons, transactionsFor } from "@/lib/data";

export const metadata = { title: "Transactions" };

export default function Transactions() {
  return (
    <>
      <PageTitle sub="Every trade, waiver claim and free-agent pickup, season by season.">Transactions</PageTitle>
      <Table caption="Seasons">
        <thead>
          <tr>
            <th className={th}>Season</th>
            <th className={thNum}>Moves</th>
          </tr>
        </thead>
        <tbody>
          {seasons().map((s) => {
            const count = transactionsFor(s.year).length;
            return (
              <tr key={s.year} className="hover:bg-field-sunk">
                <td className={td}>
                  <Link href={`/transactions/${s.year}/`} className="font-display text-2xl font-bold hover:underline">{s.year}</Link>
                </td>
                <td className={tdNum}>{count || <span className="text-chalk-dim">None</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
