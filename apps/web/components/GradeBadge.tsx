"use client";

export function GradeBadge({ grade, color }: { grade: string; color: string }) {
  return (
    <span
      className="num inline-flex min-w-10 items-center justify-center rounded px-2 py-1 text-center font-display text-lg font-bold"
      style={{ background: `${color}26`, color }}
    >
      {grade}
    </span>
  );
}

export function NABadge({ reasonLabel }: { reasonLabel: string }) {
  return (
    <span
      title={reasonLabel}
      className="num inline-flex min-w-10 items-center justify-center rounded border border-yardline px-2 py-1 text-center font-display text-lg font-bold text-chalk-dim"
    >
      N/A
    </span>
  );
}
