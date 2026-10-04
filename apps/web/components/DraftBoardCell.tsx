"use client";

import { useModal } from "./modal/ModalProvider";
import type { DraftBoardPickView } from "@/lib/draftBoardView";

function PickLookup({ view }: { view: DraftBoardPickView }) {
  const row = (label: string, value: string) => (
    <>
      <dt className="text-chalk-dim">{label}</dt>
      <dd className="num text-right">{value}</dd>
    </>
  );
  return (
    <dl className="grid grid-cols-2 gap-y-2 text-sm">
      {row("Draft position", view.draftRankText)}
      {row("Season finish", view.finishRankText)}
      {row("Points per game", view.pointsPerGameText)}
    </dl>
  );
}

/** A draft board cell's player line — clicking it opens a lookup modal (draft position / season finish / PPG). No grade here; see /draft-grades. */
export function DraftBoardCell({ view }: { view?: DraftBoardPickView }) {
  const modal = useModal();
  if (!view) return null;
  return (
    <button
      type="button"
      onClick={() => modal.open({ title: `${view.playerName} — ${view.position}`, content: <PickLookup view={view} /> })}
      className="block text-left text-sm text-chalk-dim decoration-yardline underline-offset-4 hover:text-chalk hover:underline"
    >
      {view.playerName}
      {view.position && ` · ${view.position}`}
    </button>
  );
}
