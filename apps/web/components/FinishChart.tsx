/**
 * Regular-season rank by year, 1st at the top. Gold rings mark titles.
 * Hand-rolled SVG: tiny, static, and themable through CSS variables.
 */
export function FinishChart({
  points,
  teams,
  color,
}: {
  points: { year: number; rank: number; champion: boolean }[];
  teams: number;
  color: string;
}) {
  if (points.length < 2) return null;
  const W = 640, H = 220, padL = 36, padR = 16, padT = 16, padB = 32;
  const years = points.map((p) => p.year);
  const x = (y: number) => padL + ((y - years[0]!) / (years.at(-1)! - years[0]! || 1)) * (W - padL - padR);
  const y = (r: number) => padT + ((r - 1) / (teams - 1)) * (H - padT - padB);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.year)} ${y(p.rank)}`).join("");
  const ticks = [1, Math.ceil(teams / 2), teams];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Regular-season finish by year" className="w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--yardline)" strokeDasharray={t === 1 ? undefined : "3 4"} />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--chalk-dim)">{t}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p) => (
        <g key={p.year}>
          {p.champion && <circle cx={x(p.year)} cy={y(p.rank)} r="10" fill="none" stroke="var(--gold)" strokeWidth="2.5" />}
          <circle cx={x(p.year)} cy={y(p.rank)} r="5" fill={color} />
          <text x={x(p.year)} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--chalk-dim)">{p.year}</text>
        </g>
      ))}
    </svg>
  );
}
