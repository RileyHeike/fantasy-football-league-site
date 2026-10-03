import { notFound } from "next/navigation";
import { formatDate, type Transaction } from "@league/core";
import { ManagerName, PageTitle, SectionTitle } from "@/components/ui";
import { league, playerName, season, transactionsFor } from "@/lib/data";

export function generateStaticParams() {
  return league().seasons.map((s) => ({ year: String(s.year) }));
}

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  return { title: `${(await params).year} transactions` };
}

const TYPE_LABEL: Record<string, string> = { trade: "Trade", waiver: "Waiver claim", free_agent: "Free agent" };

export default async function TransactionsPage({ params }: { params: Promise<{ year: string }> }) {
  const year = Number((await params).year);
  const s = season(year);
  if (!s) notFound();
  const transactions = transactionsFor(year);

  const byWeek = new Map<number, Transaction[]>();
  for (const t of transactions) byWeek.set(t.week, [...(byWeek.get(t.week) ?? []), t]);

  return (
    <>
      <PageTitle sub={`${transactions.length} move${transactions.length === 1 ? "" : "s"} this season.`}>{year} transactions</PageTitle>
      {transactions.length === 0 && <p className="text-chalk-dim">No transactions recorded for this season.</p>}
      {[...byWeek.entries()].map(([week, moves]) => (
        <section key={week} className="mb-10">
          <SectionTitle>Week {week}</SectionTitle>
          <ul className="grid gap-3 md:grid-cols-2">
            {moves.map((t) => <TransactionCard key={t.id} t={t} />)}
          </ul>
        </section>
      ))}
    </>
  );
}

function TransactionCard({ t }: { t: Transaction }) {
  return (
    <li className="rounded-lg border border-yardline px-4 py-3">
      <p className="mb-2 flex items-center justify-between text-sm text-chalk-dim">
        <span>{TYPE_LABEL[t.type] ?? t.type}</span>
        <span>{formatDate(t.created)}</span>
      </p>
      {t.managerIds.length > 1 ? (
        <div className="grid grid-cols-2 gap-3">
          {t.managerIds.map((mid) => (
            <div key={mid}>
              <ManagerName id={mid} />
              <ul className="mt-1 text-sm text-chalk-dim">
                {t.adds.filter((a) => a.managerId === mid).map((a) => <li key={a.playerId}>+ {playerName(a.playerId)}</li>)}
                {t.drops.filter((d) => d.managerId === mid).map((d) => <li key={d.playerId}>− {playerName(d.playerId)}</li>)}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <ManagerName id={t.managerIds[0]!} />
          <ul className="mt-1 text-sm text-chalk-dim">
            {t.adds.map((a) => <li key={a.playerId}>+ {playerName(a.playerId)}</li>)}
            {t.drops.map((d) => <li key={d.playerId}>− {playerName(d.playerId)}</li>)}
          </ul>
          {t.faabBid !== undefined && <p className="mt-1 text-sm text-chalk-dim">${t.faabBid} FAAB</p>}
        </div>
      )}
    </li>
  );
}
