/**
 * Manager "jersey" colors. Muted enough to sit on Field Night, distinct enough
 * to tell apart in a chart legend. A manager keeps their color forever
 * (Manager.colorIndex). Gold is deliberately absent: it belongs to champions.
 */
export const JERSEYS = [
  "#5b8def", // royal
  "#e0774a", // burnt orange
  "#4fb7a8", // teal
  "#c45c8e", // magenta
  "#8f7ae5", // violet
  "#6fae4f", // kelly green
  "#d4544f", // cardinal
  "#4aa3d6", // sky
  "#9fc3e6", // ice
  "#9c6fb0", // plum
  "#5f8f8a", // sage
  "#d9708a", // rose
  "#7a8fa8", // steel
  "#a8a04a", // olive
] as const;

export const jersey = (colorIndex: number) => JERSEYS[colorIndex % JERSEYS.length]!;
