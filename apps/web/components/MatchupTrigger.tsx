"use client";

import type { ReactNode } from "react";
import { useModal } from "./modal/ModalProvider";
import { MatchupView } from "./MatchupView";
import type { MatchupData } from "@/lib/matchup";

/**
 * Wraps any clickable matchup summary (a Scoreboard card, a record row, ...)
 * and opens the shared modal with the full box score on click. Pass `stack`
 * to push on top of an already-open modal (e.g. drilling in from a record
 * leaderboard) instead of opening a fresh one.
 */
export function MatchupTrigger({
  matchup,
  children,
  className,
  stack,
}: {
  matchup: MatchupData;
  children: ReactNode;
  className?: string;
  stack?: boolean;
}) {
  const modal = useModal();
  const view = { title: matchup.label, content: <MatchupView matchup={matchup} /> };
  return (
    <button type="button" className={className} onClick={() => (stack ? modal.push(view) : modal.open(view))}>
      {children}
    </button>
  );
}
