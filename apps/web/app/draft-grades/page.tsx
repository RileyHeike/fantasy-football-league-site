import { DraftGradeExplorer, DraftGradeSeasonExplorer } from "@/components/DraftGradeExplorer";
import { PageTitle, SectionTitle } from "@/components/ui";
import { buildDraftGradeLeaderboard } from "@/lib/data";

export const metadata = { title: "Draft grades" };

export default function DraftGrades() {
  const view = buildDraftGradeLeaderboard();
  return (
    <>
      <PageTitle sub="Every graded pick compares where a player was taken at his position to where he actually finished that season. Kickers, defenses, and picks that never recorded a season are left out of the grade entirely.">
        Draft grades
      </PageTitle>
      <section className="mb-14">
        <SectionTitle>All-time</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {view.career.map((row) => (
            <DraftGradeExplorer key={row.managerId} row={row} />
          ))}
        </div>
      </section>
      {view.seasons.map(({ season, rows }) => (
        <section key={season} className="mb-14">
          <SectionTitle>{season}</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((row) => (
              <DraftGradeSeasonExplorer key={row.managerId} row={row} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
