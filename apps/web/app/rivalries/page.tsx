import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { league, stats } from "@/lib/data";
import { jersey } from "@/lib/palette";

export const metadata = { title: "Rivalries" };

/** Every manager vs every manager. Green leans toward the row manager, red toward the column. */
export default function Rivalries() {
  const h2h = stats().headToHead;
  const ms = league().managers;
  return (
    <>
      <PageTitle sub="Read across a row: that manager's all-time record against each opponent, playoffs included.">Rivalries</PageTitle>
      <div className="w-fit max-w-full overflow-x-auto rounded-lg border border-yardline">
        <table className="border-collapse text-sm">
          <caption className="sr-only">Head-to-head records</caption>
          <thead>
            <tr>
              <th className="sticky left-0 bg-field p-2" />
              {ms.map((m) => (
                <th key={m.id} scope="col" className="h-28 w-12 p-1 align-bottom font-medium text-chalk-dim">
                  <span className="inline-block -rotate-60 origin-bottom-left translate-x-4 whitespace-nowrap">{m.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ms.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="sticky left-0 z-[1] whitespace-nowrap bg-field px-3 py-1 text-left font-medium">
                  <Link href={`/managers/${row.id}/`} className="inline-flex items-center gap-2 hover:underline">
                    <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: jersey(row.colorIndex) }} />
                    {row.name}
                  </Link>
                </th>
                {ms.map((col) => {
                  if (row.id === col.id) return <td key={col.id} className="border border-yardline/40 bg-field-sunk" />;
                  const l = h2h[row.id]?.[col.id];
                  if (!l) return <td key={col.id} className="border border-yardline/40 text-center text-chalk-dim">·</td>;
                  const games = l.wins + l.losses + l.ties;
                  const pct = (l.wins + l.ties / 2) / games;
                  const tint = pct === 0.5 ? "transparent" : `color-mix(in srgb, var(${pct > 0.5 ? "--win" : "--loss"}) ${Math.round(Math.abs(pct - 0.5) * 120)}%, transparent)`;
                  return (
                    <td key={col.id} className="num border border-yardline/40 px-2 py-1 text-center" style={{ background: tint }} title={`${row.name} vs ${col.name}: ${l.wins}-${l.losses}${l.ties ? `-${l.ties}` : ""}`}>
                      {l.wins}-{l.losses}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
