import { ComingSoonPage } from "@/components/ui";

export const metadata = { title: "Trade grades" };

export default function TradeGrades() {
  return (
    <ComingSoonPage
      title="Trade grades"
      blurb="Who won the trade, with the receipts — each side's return measured by what the players produced after the deal."
      note="Needs a new pipeline pulling season-long player stats from Sleeper — in progress."
    />
  );
}
