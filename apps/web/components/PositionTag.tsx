import { positionColor } from "@/lib/positions";

/** Small position badge — color is a supporting cue, the abbreviation is always the real label. */
export function PositionTag({ position }: { position?: string }) {
  if (!position) return null;
  const color = positionColor(position);
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none"
      style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
    >
      {position}
    </span>
  );
}
