# Project context for Claude Code

A public website for a 12-team Sleeper fantasy football league: standings, champions, records, rivalries and manager profiles, rebuilt nightly. Started in a claude.ai chat; this file carries over everything decided there.

Design doc (owner can open it; Claude Code cannot fetch it): https://claude.ai/code/artifact/c4c540ac-4670-4299-abd2-d8a847621aeb

## Decisions already made (don't relitigate without asking)

- **League facts:** redraft league (no future-pick tracking); every season was played on Sleeper, so the `previous_league_id` chain covers all history (~6 seasons).
- **Freshness:** refresh once a day. Live scores stay in the Sleeper app. Nightly in season (an early-Tuesday run catches Monday night and stat corrections), weekly offseason.
- **Hosting: all AWS**, chosen for learning and a "solid architecture", target ~$1–2/month:
  Amplify Hosting (static Next.js export, rebuilt by webhook after sync) · EventBridge + Lambda (sync) · S3 (raw seasons + snapshot) · SSM Parameter Store (webhook URL, config) · CDK in TypeScript for everything. Fallback if AWS becomes a slog: Vercel + Neon.
- **Public site, public GitHub repo.** No secrets in code; they live in SSM / Amplify env vars.
- **Custom domain** via Route 53 attached to Amplify (name not chosen yet).
- **Lore** (trophy names, bios, rules, punishments) comes from the owner; it goes in `content/` as Markdown/JSON.
- **Cost guardrails are mandatory:** Lambda outside any VPC (no NAT Gateway), reserved concurrency 1, 30-day log retention, budget alerts ($5), no RDS/EC2/API Gateway/WAF. The owner is new to AWS: flag anything that could add cost before doing it.
- **Credentials:** the owner deploys with their own login (`aws configure sso`, `npx cdk deploy`). Never ask them to paste keys, and never write credentials to files.

## Deviation from the design doc

The doc mentions DynamoDB for derived stats. The current code instead writes one precomputed `snapshot/latest.json` to S3, which the Amplify build downloads. That is simpler and cheaper for a static site. Revisit DynamoDB only if a feature needs per-item reads at runtime; update the doc if so.

## Layout

| Path | Contents |
| --- | --- |
| `packages/core` | Typed Sleeper client, history importer, normalizer (`LeagueHistory`), stat registry, fixture league generator, tests |
| `apps/sync` | `runSync()` used by both the CLI (files in `data/`) and the Lambda (S3) |
| `apps/web` | Next.js 15 static export, Tailwind v4, reads `data/snapshot.json` at build |
| `infra` | CDK stack (separate `npm install`; `npx cdk synth` works with no AWS account) |
| `content/league.config.json` | League ID, manager identity map, trophy names, last-place rule |

## Commands

```bash
npm install
npm run sync:fixture        # demo league, no network
npm run sync                # real league (needs leagueId in content/league.config.json)
npm test                    # vitest, packages/core
npm run typecheck
npm run dev                 # site at localhost:3000
npm run build               # static export to apps/web/out
cd infra && npm install && npx cdk synth
```

## Conventions

- Pages and stats read the normalized `LeagueHistory`, never raw Sleeper shapes. Raw responses are stored untouched.
- New stat = a `defineStat()` module registered in `packages/core/src/stats/index.ts`, plus a test. Bump `SCHEMA_VERSION` in `snapshot.ts` on breaking snapshot changes.
- Design system "Night game": colors only through tokens in `apps/web/app/globals.css`. **Gold is reserved for champions and records**; win/loss green/red only for results; each manager keeps a jersey color (`lib/palette.ts`, never gold-like); player positions get their own small muted palette (`lib/positions.ts`). Type: Big Shoulders Display + Barlow. Avoid all-caps eyebrow labels and decorative motion; one load animation (the ring of honor) only.
- `players_points` in Sleeper matchups is unofficial; treat as optional.
- New clickable box score / drill-down UI → reuse the modal system (`components/modal/ModalProvider.tsx`, `useModal()`'s `open`/`push`/`back`/`close`), not a one-off dialog. Client components that need manager/player display data take plain pre-resolved props (see `lib/matchup.ts`, `lib/recordView.ts`) built by a server component — never import `lib/data.ts` (marked `server-only`) from a client component.
- New feature needing a player's fantasy performance → read `LeagueHistory.playerSeasonFinishes` / `playerWeeklyPoints`, and if raw Sleeper stats are ever touched directly, always run them through `scorePoints()` (`packages/core/src/scoring.ts`). Never use the stats API's own `pts_std`/`pts_half_ppr`/`pts_ppr` fields — verified wrong for this league's actual (distance-based) kicker scoring.
- Not-yet-built pages still get a real nav entry with a "coming soon" tag and a placeholder page (`ComingSoonPage` in `components/ui.tsx`) explaining what's coming, rather than a dead link or no entry at all.

## Status

**Live** at `https://master.d3tmi0z43d0yoo.amplifyapp.com`, deployed to AWS, syncing nightly.
Full architecture, AWS resource IDs, and the deploy workflow are in `.claude/architecture.md` — read that before touching infra or the sync pipeline.

Done: core pipeline, stats (standings, head-to-head, records, all-play/luck, trophies, bracket trees), the player-finish data pipeline (season positional finish + transaction-scoped weekly points, see architecture.md §5), 26 passing tests, local sync.
Pages: home, standings, history/season, managers/profile, records (interactive — click a card for the top 10, click a row for the box score), rivalries, transactions, draft boards, and six "coming soon" placeholders.
Reusable click-through matchup/box-score modal used on the homepage and the records page.
Nav reorganized into dropdown groups (This season / League / Moves) plus pinned Home and Records, with a mobile "More" sheet.

Next, in order:
1. **Draft grades, trade grades, waiver wire value** — the data pipeline is built and verified (see architecture.md §5); write the three `defineStat()` modules and replace their "coming soon" placeholders.
2. **Power rankings, lineup efficiency, manager tendencies** — no new data needed, just the stat modules and pages.
3. Real trophy names and lore content (bios, rules, punishments) from the owner.
4. Custom domain via Route 53.
