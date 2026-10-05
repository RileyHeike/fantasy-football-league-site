export interface StatLineEntry {
  label: string;
  value: number;
}

const STAT_LINE_CONFIG: Record<string, { key: string; label: string }[]> = {
  QB: [
    { key: "pass_cmp", label: "cmp" },
    { key: "pass_att", label: "att" },
    { key: "pass_yd", label: "yd" },
    { key: "pass_td", label: "TD" },
    { key: "pass_int", label: "INT" },
    { key: "rush_att", label: "car" },
    { key: "rush_yd", label: "yd" },
    { key: "rush_td", label: "TD" },
  ],
  RB: [
    { key: "rush_att", label: "car" },
    { key: "rush_yd", label: "yd" },
    { key: "rush_td", label: "TD" },
    { key: "rec", label: "rec" },
    { key: "rec_yd", label: "yd" },
    { key: "rec_td", label: "TD" },
  ],
  WR: [
    { key: "rec", label: "rec" },
    { key: "rec_tgt", label: "tgt" },
    { key: "rec_yd", label: "yd" },
    { key: "rec_td", label: "TD" },
  ],
  TE: [
    { key: "rec", label: "rec" },
    { key: "rec_tgt", label: "tgt" },
    { key: "rec_yd", label: "yd" },
    { key: "rec_td", label: "TD" },
  ],
  K: [
    { key: "fgm", label: "FGM" },
    { key: "fga", label: "FGA" },
    { key: "xpm", label: "XPM" },
    { key: "xpa", label: "XPA" },
  ],
  DEF: [
    { key: "sack", label: "sack" },
    { key: "int", label: "INT" },
    { key: "fum_rec", label: "FR" },
    { key: "def_td", label: "TD" },
    { key: "ff", label: "FF" },
    { key: "pts_allow", label: "pts allow" },
  ],
};

/** Decodes a player's raw per-category stat line into a position-appropriate headline stat row. */
export function statLineFor(position: string, rawStats: Record<string, number>): StatLineEntry[] {
  return (STAT_LINE_CONFIG[position] ?? []).map(({ key, label }) => ({ label, value: rawStats[key] ?? 0 }));
}
