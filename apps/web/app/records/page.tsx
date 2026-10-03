import { formatPoints, type LeagueRecord } from "@league/core";
import { ManagerName, PageTitle, SectionTitle } from "@/components/ui";
import { stats } from "@/lib/data";

export const metadata = { title: "Record book" };

const GROUPS: { key: LeagueRecord["category"]; title: string }[] = [
  { key: "game", title: "Single game" },
  { key: "season", title: "Single season" },
  { key: "streak", title: "Streaks" },
];

const fmt = (r: { value: number }, unit: LeagueRecord["unit"]) => (unit === "pts" ? formatPoints(r.value) : String(r.value));
const when = (r: { season: number; week?: number }) => (r.week ? `Week ${r.week}, ${r.season}` : String(r.season));

export default function Records() {
  const all = stats().records;
  return (
    <>
      <PageTitle sub="The best and worst the league has seen. Each record shows the top five.">Record book</PageTitle>
      {GROUPS.map((grp) => (
        <section key={grp.key} className="mb-14">
          <SectionTitle>{grp.title}</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {all.filter((r) => r.category === grp.key).map((r) => (
              <article key={r.id} className="rounded-lg border border-yardline p-5">
                <h3 className="text-chalk-dim">{r.label}</h3>
                <p className="num mt-1 font-display text-5xl font-extrabold text-gold">{fmt(r, r.unit)}</p>
                <div className="mt-2"><ManagerName id={r.managerId} sub={`${when(r)}${r.opponentId ? "" : ""}`} /></div>
                {r.runnersUp.length > 0 && (
                  <ol start={2} className="mt-4 space-y-1 border-t border-yardline pt-3 text-sm">
                    {r.runnersUp.map((h, i) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-3"><span className="num w-4 text-chalk-dim">{i + 2}</span><ManagerName id={h.managerId} /></span>
                        <span className="num text-chalk-dim">{fmt(h, r.unit)} <span className="ml-2">{when(h)}</span></span>
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
