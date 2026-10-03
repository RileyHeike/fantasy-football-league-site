/** Small display helpers shared by the site and any future bot or email. */
export const formatPoints = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatRecord = (w: number, l: number, t = 0) => (t ? `${w}-${l}-${t}` : `${w}-${l}`);

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}
