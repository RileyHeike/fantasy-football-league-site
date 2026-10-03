import type { LeagueRecord } from "@league/core";
import { RecordExplorer } from "@/components/RecordExplorer";
import { PageTitle, SectionTitle } from "@/components/ui";
import { buildRecordCard, stats } from "@/lib/data";

export const metadata = { title: "Record book" };

const GROUPS: { key: LeagueRecord["category"]; title: string }[] = [
  { key: "game", title: "Single game" },
  { key: "season", title: "Single season" },
  { key: "streak", title: "Streaks" },
];

export default function Records() {
  const all = stats().records;
  return (
    <>
      <PageTitle sub="The best and worst the league has seen. Tap a card for the top 10.">Record book</PageTitle>
      {GROUPS.map((grp) => (
        <section key={grp.key} className="mb-14">
          <SectionTitle>{grp.title}</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {all.filter((r) => r.category === grp.key).map((r) => (
              <RecordExplorer key={r.id} card={buildRecordCard(r)} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
