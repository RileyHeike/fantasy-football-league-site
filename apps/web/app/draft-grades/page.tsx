import { ComingSoonPage } from "@/components/ui";

export const metadata = { title: "Draft grades" };

export default function DraftGrades() {
  return (
    <ComingSoonPage
      title="Draft grades"
      blurb="Every pick, graded against how that player actually finished the season at his position."
      note="Needs a new pipeline pulling season-long player stats from Sleeper — in progress."
    />
  );
}
