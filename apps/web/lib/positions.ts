/**
 * Player position accent colors, in the spirit of palette.ts's manager
 * jerseys: plain hex, not theme tokens, applied as translucent tints so they
 * read as this site's muted "Night game" language rather than a bolted-on
 * badge. Deliberately kept clear of --gold/--win/--loss so a position tag
 * never competes with the site's reserved result/trophy colors.
 */
export const POSITION_COLORS: Record<string, string> = {
  QB: "#b5633f",
  RB: "#3f9fae",
  WR: "#6b8fd9",
  TE: "#c47191",
  K: "#9a7fd4",
  DEF: "#8893a3",
};

export const positionColor = (position?: string): string => (position && POSITION_COLORS[position]) || "#7a8fa8";
