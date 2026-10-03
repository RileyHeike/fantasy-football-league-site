# League site

A fast, static record book for a Sleeper fantasy football league: standings, champions, records, rivalries and manager profiles, rebuilt nightly from the Sleeper API.

## Quick start (no league ID or network needed)

```bash
npm install
npm run sync:fixture   # builds data/snapshot.json from a generated 7-season demo league
npm run dev            # http://localhost:3000
npm test               # core test suite
```

To use the real league, put the current season's league ID in `content/league.config.json` and run `npm run sync`. Earlier seasons are found automatically through Sleeper's `previous_league_id` chain.

## How it fits together

```
Sleeper API ─► sync (apps/sync) ─► raw seasons + snapshot.json ─► static site (apps/web)
                  │                     (data/ locally, S3 on AWS)
                  └─ @league/core: client → importer → normalizer → stat registry
```

| Path | What lives there |
| --- | --- |
| `packages/core` | Everything with no UI: typed Sleeper client, history importer, normalized league model, stat modules, fixture league generator, tests |
| `apps/sync` | The sync job. Same `runSync()` runs from the CLI (files) and Lambda (S3) |
| `apps/web` | Next.js static export. Reads the snapshot at build time; ships ~106 kB of JS |
| `infra` | AWS CDK stack: S3, sync Lambda, nightly schedule, alarms, budget, Amplify build role |
| `content` | Hand-written league config and (later) lore: bios, trophies, rules |
| `data` | Local sync output (git-ignored) |

### Key design decisions

- **Store raw, derive later.** Untouched Sleeper responses are saved per season. A new stat is a re-run, not a re-download. Completed seasons are never fetched again.
- **One normalized model.** Pages and stats read `LeagueHistory` (managers, seasons, games, transactions, picks), never raw API shapes.
- **Managers outlive seasons.** A manager is a person with one or more Sleeper accounts. Map extra accounts in `content/league.config.json` (`managers[].userIds`).
- **Snapshot schema version.** The site refuses a snapshot from a different `SCHEMA_VERSION` instead of half-rendering.

## Extending

**Add a stat.** Create `packages/core/src/stats/myStat.ts`:

```ts
import { defineStat } from "./context";

export const myStat = defineStat({
  id: "myStat",
  title: "My stat",
  description: "What it measures.",
  compute(ctx) {
    // ctx.league, ctx.perspectives (one row per manager per game), ctx.regularGames, ...
    return { /* any JSON-serializable shape */ };
  },
});
```

Register it in `STAT_MODULES` in `stats/index.ts`. Its result appears at `snapshot.stats.myStat`, fully typed in the web app. Add a test next to the others.

**Add a page.** Create `apps/web/app/<route>/page.tsx`, read data through `lib/data.ts`, and build with the primitives in `components/ui.tsx`. Dynamic routes need `generateStaticParams()`.

## Design system: "Night game"

Tokens live in `apps/web/app/globals.css`; components only use token classes, so the light theme ("Day game") swaps in for free.

| Token | Dark | Use |
| --- | --- | --- |
| `field` | `#0E1A2B` | Page background |
| `field-raised` / `field-sunk` | `#142338` / `#0A1422` | Panels / wells |
| `yardline` | `#263A52` | Borders and rules |
| `chalk` / `chalk-dim` | `#E9EEF2` / `#9AABBD` | Text |
| `gold` | `#E8B04B` | Champions and records only |
| `win` / `loss` | `#3FB67A` / `#E05A4F` | Results only |

Type: Big Shoulders Display (headlines, scores) and Barlow (body, tabular figures). Each manager keeps one "jersey" color forever (`lib/palette.ts`); gold is never a jersey.

## Deploying to AWS (later)

You run these yourself with your own credentials; nothing secret goes in the repo.

1. Sign in locally with `aws configure sso` (or another credentials method).
2. Set your email in `infra/cdk.json` (`budgetEmail`), then:
   ```bash
   cd infra && npm install
   npx cdk bootstrap
   npx cdk deploy
   ```
3. Confirm the SNS and budget subscription emails.
4. Create an Amplify app from the GitHub repo in the console. Set env var `DATA_BUCKET` and the service role to the `AmplifyBuildRoleArn` output.
5. Create an Amplify incoming webhook and store its URL in the `/league-site/amplify-build-hook` parameter.
6. Invoke the sync Lambda once to load history, then let the nightly schedule run.

Run `npx cdk synth` any time to validate the stack without an AWS account.
