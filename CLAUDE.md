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
- Design system "Night game": colors only through tokens in `apps/web/app/globals.css`. **Gold is reserved for champions and records**; win/loss green/red only for results; each manager keeps a jersey color (`lib/palette.ts`, never gold-like). Type: Big Shoulders Display + Barlow. Avoid all-caps eyebrow labels and decorative motion; one load animation (the ring of honor) only.
- `players_points` in Sleeper matchups is unofficial; treat as optional.

## Status

Done: core pipeline, stats (standings, head-to-head, records, all-play/luck, trophies), 18 passing tests, local sync, home / standings / history / season / managers / profile / records / rivalries pages, light theme, CDK stack that synthesizes.

Next, in order:
1. **Owner provides the current Sleeper league ID.** Run `npm run sync`, then do the launch-gate check: each season's champion, standings and a few records must match the Sleeper app. Fill in `content/league.config.json` (extra accounts per manager, trophy names, `lastPlaceRule`).
2. Phase 2 pages: transactions (trades and waivers), draft boards, playoff bracket view, lore content.
3. AWS: `cdk bootstrap` + `cdk deploy` by the owner; confirm SNS/budget emails; Amplify app from GitHub with `DATA_BUCKET` env var and the `AmplifyBuildRoleArn` service role; store the Amplify webhook URL in `/league-site/amplify-build-hook`; invoke the sync Lambda once; then Route 53 domain.
4. Phase 4: lineup efficiency, power rankings, trade and draft grades, more charts.
