import { ComingSoonPage } from "@/components/ui";

export const metadata = { title: "Waiver wire value" };

export default function WaiverValue() {
  return (
    <ComingSoonPage
      title="Waiver wire value"
      blurb="FAAB spent vs. points gained, counted from the week you picked the player up — not his whole season."
      note="Needs a new pipeline pulling season-long player stats from Sleeper — in progress."
    />
  );
}
