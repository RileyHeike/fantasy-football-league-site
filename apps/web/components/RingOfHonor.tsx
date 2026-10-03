import Link from "next/link";
import { formatPoints, type TrophyCase } from "@league/core";
import { manager, teamName } from "@/lib/data";
import { jersey } from "@/lib/palette";

/**
 * Champions hung like banners on a stadium facade. The reigning champion's
 * banner is gold and larger; past years hang beside it in their jersey color.
 */
export function RingOfHonor({ cases, trophyName }: { cases: TrophyCase[]; trophyName: string }) {
  const [reigning, ...past] = cases.filter((c) => c.champion);
  if (!reigning) return null;
  const champ = manager(reigning.champion!);
  const notch = "polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 22px), 0 100%)";
  return (
    <section aria-label={`${trophyName} champions`} className="mb-14">
      <div className="flex flex-col gap-6 md:flex-row md:items-stretch">
        <Link
          href={`/managers/${champ.id}/`}
          className="banner-drop block w-full shrink-0 bg-gold px-7 pb-14 pt-6 text-gold-ink md:w-[22rem]"
          style={{ clipPath: notch }}
        >
          <p className="font-display text-2xl font-bold">{reigning.season} {trophyName}</p>
          <p className="mt-6 font-display text-7xl font-extrabold leading-[0.85] tracking-tight">{champ.name}</p>
          <p className="mt-3 text-lg font-medium">{teamName(champ.id, reigning.season)}</p>
          {reigning.final && (
            <p className="num mt-6 font-display text-3xl font-bold">
              {formatPoints(reigning.final.winnerPoints)} to {formatPoints(reigning.final.loserPoints)}
            </p>
          )}
        </Link>

        <ol className="-mx-5 flex flex-1 gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-5 md:grid-rows-[1fr] md:overflow-visible md:px-0 md:pb-0" aria-label="Past champions">
          {past.map((c, i) => {
            const m = manager(c.champion!);
            return (
              <li key={c.season} className="banner-drop w-32 shrink-0 md:w-auto" style={{ animationDelay: `${120 + i * 70}ms` }}>
                <Link
                  href={`/history/${c.season}/`}
                  className="flex h-full min-h-44 flex-col justify-between border-t-4 bg-field-raised px-3 pb-10 pt-3 hover:bg-field-sunk"
                  style={{ clipPath: notch, borderColor: jersey(m.colorIndex) }}
                >
                  <span className="block font-display text-3xl font-extrabold leading-none">{c.season}</span>
                  <span>
                    <span className="block truncate font-display text-2xl font-bold leading-tight">{m.name}</span>
                    <span className="block truncate text-sm text-chalk-dim">{teamName(m.id, c.season)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
