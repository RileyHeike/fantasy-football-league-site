"use client";

import { ManagerBadge } from "./ManagerBadge";
import { MatchupView } from "./MatchupView";
import { useModal } from "./modal/ModalProvider";
import type { RecordCardView, RecordRowView } from "@/lib/recordView";

/** A record card that opens a top-10 leaderboard; rows with a resolved game drill into the box score. */
export function RecordExplorer({ card }: { card: RecordCardView }) {
  const modal = useModal();
  return (
    <button
      type="button"
      onClick={() => modal.open({ title: card.label, content: <RecordTopTen card={card} /> })}
      className="block w-full rounded-lg border border-yardline p-5 text-left transition-colors hover:border-chalk-dim"
    >
      <h3 className="text-chalk-dim">{card.label}</h3>
      <p className="num mt-1 font-display text-5xl font-extrabold text-gold">{card.valueText}</p>
      <div className="mt-2">
        <ManagerBadge name={card.managerName} colorIndex={card.colorIndex} sub={card.whenText} />
      </div>
      <p className="mt-3 text-xs text-chalk-dim">Tap to see the top 10 →</p>
    </button>
  );
}

function RecordTopTen({ card }: { card: RecordCardView }) {
  return (
    <ol className="space-y-1 text-sm">
      {card.rows.map((row) => (
        <RecordRow key={row.rank} row={row} />
      ))}
    </ol>
  );
}

function RecordRow({ row }: { row: RecordRowView }) {
  const modal = useModal();
  const body = (
    <>
      <span className="flex items-center gap-3">
        <span className="num w-5 text-chalk-dim">{row.rank}</span>
        <ManagerBadge name={row.managerName} colorIndex={row.colorIndex} />
      </span>
      <span className="num text-right text-chalk-dim">
        {row.valueText}
        <span className="ml-2">{row.whenText}</span>
      </span>
    </>
  );
  if (!row.matchup) {
    return <li className="flex items-center justify-between gap-3 px-2 py-1.5">{body}</li>;
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => modal.push({ title: row.matchup!.label, content: <MatchupView matchup={row.matchup!} /> })}
        className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left hover:bg-field-sunk"
      >
        {body}
      </button>
    </li>
  );
}
