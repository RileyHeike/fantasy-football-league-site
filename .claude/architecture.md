# Architecture & deployment reference

This document describes the full application stack as actually deployed, not just as designed.
It is a living reference for whoever (human or Claude) next touches infrastructure or deployment.
Update it whenever a resource, workflow step, or account-level setting changes.

## 1. Overview

A public static site for a 12-team Sleeper fantasy football league.
It shows standings, champions, records, rivalries, manager profiles, transactions, and draft boards across the league's full history, plus an interactive record book with click-through box scores.
The site rebuilds nightly from live Sleeper data.
Everything runs on AWS, chosen deliberately for learning and to keep monthly cost near $1–2.

League ID: `1389722682865483776`.
League name: "Sped Seattleites".
AWS account: `441659297085`.
AWS region for everything: `us-west-2`.
GitHub repo: `https://github.com/RileyHeike/fantasy-football-league-site` (public).
Default branch: `master`.
Live URL (no custom domain yet): `https://master.d3tmi0z43d0yoo.amplifyapp.com`.

## 2. Data flow

```
Sleeper API (api.sleeper.app/v1, documented)         Sleeper stats API (api.sleeper.com, undocumented)
   │  league/rosters/matchups/transactions/draft         │  season + weekly player stat lines
   ▼                                                      ▼
sync Lambda (nightly, EventBridge-triggered)
   │  writes raw seasons, player stats, snapshot/latest.json
   ▼
S3 bucket (leaguesite-data666c94c7-ddd6eugomj6j)
   │
   │  Lambda then reads the webhook URL from SSM and POSTs to it
   ▼
Amplify incoming webhook
   │
   ▼
Amplify build (npm ci → download snapshot from S3 → npm run build → static export)
   │
   ▼
Amplify Hosting (CDN-served static site)
```

The same `runSync()` function in `apps/sync` powers both the local CLI (writes to `data/` on disk) and the Lambda (writes to S3).
Only the storage adapters differ.

## 3. Repository layout

| Path | Contents |
| --- | --- |
| `packages/core` | Typed Sleeper API client, history importer, normalizer (produces `LeagueHistory`), stat registry, scoring engine, fixture league generator, vitest tests |
| `apps/sync` | `runSync()`, shared by the CLI (`src/cli.ts`, local files) and the Lambda (`src/lambda.ts`, S3) |
| `apps/web` | Next.js 15 static export (Tailwind v4), reads `data/snapshot.json` at build time |
| `infra` | CDK stack in TypeScript (`lib/league-stack.ts`, entry `bin/app.ts`) |
| `content/league.config.json` | League ID, league name, manager identity overrides, trophy names, last-place rule |
| `amplify.yml` | Amplify Hosting build spec (repo root) |
| `.claude/architecture.md` | This file |

Notable files inside `packages/core/src` worth knowing about by name:

- `sleeper/client.ts` — the stable, documented Sleeper API client.
- `sleeper/statsClient.ts` — a **separate, isolated** client for Sleeper's undocumented stats API. See section 5.
- `scoring.ts` — `scorePoints()`, a generic dot product of raw stat categories against any league's `scoring_settings`. Used by the player-finish pipeline; reusable for anything else that needs to turn raw Sleeper stats into points.
- `model/normalize.ts` — turns raw API responses into `LeagueHistory`. Also where bracket trees and player-finish data get computed from their raw inputs.

## 4. AWS resources (CDK stack `LeagueSite`)

Defined in `infra/lib/league-stack.ts`, deployed via `cdk deploy` from the owner's own AWS SSO login.
All resources live in a single CloudFormation stack named `LeagueSite`.

### S3 bucket — league data

- Logical ID `Data`, physical name `leaguesite-data666c94c7-ddd6eugomj6j`.
- Block all public access.
- S3-managed encryption.
- TLS enforced (a bucket policy explicitly denies any request without `aws:SecureTransport`).
- Not versioned.
- Removal policy `RETAIN` — league history survives a `cdk destroy`.
- Layout inside the bucket:
  - `raw/<year>.json` — untouched Sleeper league/roster/matchup responses per season.
  - `playerStats/<year>.json` — season-total stat lines per position for one completed season (see section 5). Six positions fetched once, never refetched once a season is complete.
  - `playerWeekly/<playerId>-<year>.json` — week-by-week stat lines for one player in one season, only for players who were ever part of a trade or waiver/free-agent move.
  - `snapshot/latest.json` — the derived, normalized snapshot the web app reads at build time.

### SSM Parameter Store — build hook URL

- Parameter name `/league-site/amplify-build-hook`.
- Type `String`, Standard tier (free).
- CDK creates it with a placeholder value of `"unset"`.
- After the Amplify app and its webhook exist, the real webhook URL is written in by hand (not by CDK) — see section 6.
- The current value is the `league-sync` webhook's URL with `&operation=startbuild` appended, so a bare `fetch(url, { method: "POST" })` triggers a build.

### Lambda — nightly sync

- Logical ID `Sync`, function name `LeagueSite-SyncEC3EAE86-WuPjgEmAs1J0`.
- Entry point `apps/sync/src/lambda.ts`, bundled as ESM with esbuild via `aws_lambda_nodejs.NodejsFunction`.
- Runtime Node.js 22.x, architecture ARM_64, memory 512 MB, timeout 10 minutes.
- `reservedConcurrentExecutions: 1` and `retryAttempts: 0` — only one invocation can ever run at a time, and EventBridge won't retry a failure.
- No VPC attachment, so no NAT Gateway cost.
- Environment variables: `DATA_BUCKET` (the bucket name above) and `BUILD_HOOK_PARAM` (the SSM parameter name above).
- IAM: read/write on the data bucket, read on the SSM parameter, plus the `AWSLambdaBasicExecutionRole` managed policy for CloudWatch Logs.
- Logs go to a dedicated log group with 30-day retention and `DESTROY` removal policy.

Behavior inside the handler:
1. Call Sleeper's `nflState` endpoint.
2. If the season is offseason (`season_type` is neither `regular` nor `post`) and today is not Tuesday (UTC), skip and return early — this is how "nightly in season, weekly in the offseason" is implemented.
3. Otherwise call `runSync()`, which:
   a. Fetches every season from the current league back through `previous_league_id`, writes `raw/<year>.json` for each.
   b. For any completed season without cached `playerStats`, fetches season-total stats for all six fantasy positions (sequential, 100ms apart, same rate-limit discipline as the main importer) and caches them.
   c. For every player who was ever part of a trade/waiver/free-agent move, fetches weekly stats — skipped if already cached for a completed season, always refreshed for the current one.
   d. Writes `snapshot/latest.json`.
4. Read the webhook URL from SSM and `POST` to it to trigger an Amplify rebuild.

**Timing observed in production:** the first run of the player-finish pipeline (full backfill — 36 season-stats calls, ~1,675 weekly-stats calls) took 3 minutes 52 seconds, comfortably inside the 10-minute timeout. Subsequent runs are seconds, since completed-season data is cached and only the current season's ~100 relevant players get refetched.

### EventBridge rule — nightly trigger

- Logical ID `Nightly`.
- Cron schedule: minute 0, hour value from `cdk.json`'s `syncHourUtc` context (currently `9`, i.e. 9:00 AM UTC daily).
- Target: the sync Lambda, with `retryAttempts: 0`.

### CloudWatch alarm + SNS — failure notification

- SNS topic `Alerts`, with an email subscription to `rileyheike@gmail.com`.
- Alarm `SyncFailed` watches the Lambda's `Errors` metric over a 1-day period, threshold 1, `treatMissingData: NOT_BREACHING` (so a day with no invocation is not itself an alarm).
- On breach, publishes to the `Alerts` SNS topic, which emails the owner.

### AWS Budget — cost guardrail

- Budget name `league-site-monthly`, type `COST`, monthly limit $5 (from `cdk.json`'s `monthlyBudgetUsd`).
- Email notifications to `rileyheike@gmail.com` at 50% actual, 100% actual, and 100% forecasted.

### IAM role — Amplify build access

- Logical ID `AmplifyBuildRole`, physical ARN `arn:aws:iam::441659297085:role/LeagueSite-AmplifyBuildRole1497EA74-zzTtI3lXlG4K`.
- Trust policy: assumable by the `amplify.amazonaws.com` service principal.
- Grants S3 read scoped to `snapshot/*` only inside the data bucket — it cannot read `raw/*`, `playerStats/*`, `playerWeekly/*`, or write anything.
- Attached to the Amplify app as its "service role," which is how the build container gets temporary AWS credentials for the `aws s3 cp` step in `amplify.yml`.

### CloudFormation outputs

`DataBucketName`, `SyncFunctionName`, `AmplifyBuildRoleArn`, `BuildHookParameter` — printed at the end of every `cdk deploy`, and the four values a human needs to wire up the Amplify console afterward.

## 5. The player-finish pipeline (draft/trade/waiver grades foundation)

Backend data foundation for three not-yet-built stat pages (draft grades, trade grades, waiver wire value) — see section 11.
Lives mostly in `packages/core/src/sleeper/statsClient.ts`, `packages/core/src/scoring.ts`, and the player-finish computation inside `packages/core/src/model/normalize.ts`.

**The dependency and its risk.** Sleeper's officially documented API (`api.sleeper.app/v1`) has no player-stats endpoint at all.
Season and weekly fantasy stats come from a *different, undocumented* host (`api.sleeper.com/stats/nfl/...`), used by the fantasy-football community but with zero stability guarantee from Sleeper — it could change shape or disappear without notice.
Deliberately isolated in its own `SleeperStatsClient` class for exactly this reason: if it breaks, only that one file needs fixing.

**Why we compute points ourselves instead of trusting the API.** The stats API returns precomputed `pts_std`/`pts_half_ppr`/`pts_ppr` fields, but these assume a fixed scoring format.
Verified directly against this league's real recorded points (`players_points` in our own matchup data) across several positions and seasons: QB and DEF matched exactly, but a kicker didn't — Sleeper's bucket said 15, the league's actual recorded points were 16.1, because this league scores field goals by exact distance yardage (`fgm_yds: 0.1`/yard), which isn't any of Sleeper's three standard buckets.
Computing points ourselves — `scorePoints()`, a plain dot product of the stats API's raw per-category numbers (`rec`, `rush_td`, `fgm_yds`, ...) against that season's own `league.scoring_settings` — reproduced the exact correct value in every case tested.
**Never use the stats API's own points fields; always run raw stats through `scorePoints()`.**

Scoring settings were confirmed identical (full PPR, standard everything) across all 7 seasons, so there's no year-to-year scoring-change handling needed — but `scorePoints()` is scoring-settings-driven by design, so it would keep working correctly even if that changes in a future season.

**What's computed, and how it's bounded:**
- `LeagueHistory.playerSeasonFinishes` — for every completed season, every player's points and rank within their position, computed from one bulk fetch per position per season (`seasonStatsByPosition`). The API's position filter isn't exclusive (a player with multiple `fantasy_positions` can come back from more than one query), so the normalizer filters to the six positions this league actually rosters (QB/RB/WR/TE/K/DEF) before ranking.
- `LeagueHistory.playerWeeklyPoints` — week-by-week points, but **only** for players who were ever part of a trade or waiver/free-agent move (~690 unique players across league history as of this writing) — not the full player universe. This is what lets trade/waiver grading sum "points produced after the move" without crediting a manager for production before they owned the player.

**A real bug hit and fixed during the first live backfill:** some weekly entries from the stats API come back as `null` (bye weeks, player not yet active) rather than an empty stats object — `computeWeeklyPoints` and `computeSeasonFinishes` both guard against this now.

**Storage:** `PlayerStatsStore` / `PlayerWeeklyStore` interfaces (`packages/core/src/store/types.ts`), File and S3 implementations following the exact same pattern as the existing raw-season and snapshot stores.
Both are optional in `SyncDeps` and entirely skipped for the offline fixture demo (`npm run sync:fixture`), which has no network and no real transactions to grade.

`SCHEMA_VERSION` is `3` as of this pipeline (was 1 at launch, 2 after the bracket-tree addition).

## 6. Amplify Hosting (not managed by CDK)

Amplify Hosting itself is created and configured by hand in the AWS console, because connecting a GitHub repo requires an interactive OAuth/GitHub-App authorization that can't be scripted without a stored token.

- App name `fantasy-football-league-site`, App ID `d3tmi0z43d0yoo`.
- Connected to `RileyHeike/fantasy-football-league-site`, branch `master`.
- Build spec: the repo's own `amplify.yml` (not an auto-generated one).
- Environment variable: `DATA_BUCKET = leaguesite-data666c94c7-ddd6eugomj6j`.
- Service role: the `AmplifyBuildRoleArn` output above.
- Incoming webhook named `league-sync`, used by the sync Lambda to trigger rebuilds after a successful sync.
- **Also auto-builds on every push to `master`** (Amplify Hosting's default behavior) — this matters whenever a change touches `packages/core` or `apps/sync`, see section 8.

`amplify.yml` build steps:
1. `npm ci`.
2. `aws s3 cp "s3://${DATA_BUCKET}/snapshot/latest.json" data/snapshot.json` — uses the attached service role's temporary credentials.
3. `npm run build` — builds `apps/web` and static-exports it.
4. Artifacts are `apps/web/out/**`.
5. Cache paths: `node_modules/**` and `apps/web/.next/cache/**`.

## 7. One-time account setup already completed

These steps are done and should not need repeating, but are recorded here since they involved manual console work outside of CDK.

1. **AWS IAM Identity Center (SSO)** enabled on the personal AWS account, with a single-account "organization."
   SSO start URL: `https://d-9267ccde7a.awsapps.com/start`, SSO region `us-west-2`.
   A user was created in Identity Center and assigned an `AdministratorAccess` permission set on the account.
   The local CLI profile is named `league-site` (`~/.aws/config`); deploys run with `export AWS_PROFILE=league-site`.
2. **Lambda concurrent-executions quota** was raised from the new-account default of 10 to the standard 1000 in `us-west-2`, because `reservedConcurrentExecutions: 1` on the sync function is impossible while the account-wide pool is at 10 (AWS requires at least 10 unreserved).
   This was a one-time AWS Support case, auto-resolved within the hour.
   It does not loosen any guardrail in the code — the function is still capped at 1 concurrent execution.
3. **Amplify app created and wired up** as described in section 6: GitHub connected, env var set, service role attached, webhook created.
4. **Webhook URL stored** in the `/league-site/amplify-build-hook` SSM parameter, overwriting CDK's `"unset"` placeholder.
   Re-running `cdk deploy` will not revert this value, since the parameter's value isn't part of the CDK-managed diff once set this way.
5. **Sync Lambda invoked manually several times** to load history into S3, confirm the webhook chain, and run the first player-finish backfill.

## 8. Deploying infrastructure or backend code changes

Any change to `infra/lib/league-stack.ts` or `infra/cdk.json` needs a redeploy, run by the account owner with their own SSO session — never by an automated agent without explicit confirmation, since `cdk deploy` can change IAM and cost-relevant resources.

```bash
cd infra
export AWS_PROFILE=league-site
npx cdk diff      # see what would change, optional but recommended
npx cdk deploy    # prompts to confirm IAM-sensitive changes
```

If the SSO session has expired, run `aws sso login --profile league-site` first (opens a browser).

**Important, established pattern:** the sync Lambda's code is bundled at `cdk deploy` time — it does *not* automatically pick up changes to `packages/core` or `apps/sync` just because they're pushed to GitHub.
Any such change needs `cdk deploy` run again before the Lambda reflects it, even if nothing in `infra/` itself changed.
The sequence that's worked every time this session:
1. Push the code.
2. Owner runs `cdk deploy` (plain code-asset changes don't need IAM-broadening approval, usually a quick confirm).
3. Invoke the Lambda once (`aws lambda invoke --function-name <name> ...`) to regenerate `snapshot/latest.json` with the new code/schema.
4. Because Amplify auto-builds on push (section 6), the push itself may have already kicked off a build against the *old* snapshot and failed with a schema-version mismatch — this is expected and harmless; the webhook POST at the end of step 3's Lambda run triggers a second build against the *new* snapshot, which succeeds.

Changing the Amplify app's configuration (env vars, service role, build spec, webhook) is done in the Amplify console, not CDK — CDK only produces the `AmplifyBuildRoleArn` and `BuildHookParameter` the console step depends on.

## 9. Ongoing nightly operation

No manual action is needed for normal operation.
Every night at 9:00 AM UTC, EventBridge invokes the sync Lambda, which syncs Sleeper data (including any new player-finish data) to S3 and then triggers an Amplify rebuild via the webhook.
In the offseason, the Lambda still runs on the EventBridge schedule but exits immediately unless it's Tuesday, to avoid pointless rebuilds when nothing has changed.
A sync failure triggers a CloudWatch alarm and an email to `rileyheike@gmail.com`.
An Amplify build failure does not currently trigger any notification — it would need to be noticed by checking the Amplify console or the live site.

## 10. Known quirks worth remembering

- The very first Amplify build (job 1) failed with a 403 on the `aws s3 cp` step, because it ran before the service role was attached to the app. One-time ordering artifact, not recurring.
- 2020's last-place "toilet bowl" final was never scored in Sleeper (`losersBracket` entry has `w: null, l: null`).
  The normalizer falls back to worst regular-season record whenever the configured `lastPlaceRule` can't resolve a result from the bracket, so no completed season is ever left without a last-place manager.
- `lastPlaceRule` is currently `consolationFinalLoser` (the toilet-bowl loser), per the league's actual rule, confirmed by the owner.
- Trophy names in `content/league.config.json` are still the generic defaults (`"The Cup"`, `"The Wooden Spoon"`) — real names haven't been provided yet.
- The git remote's default branch is `master`, not `main` — Amplify is connected to `master`.
- `apps/web/next-env.d.ts` is intentionally committed; it's a Next.js convention, not an accidental build artifact.
- Sleeper's bulk stats-by-position endpoint isn't exclusive — it can return players outside the requested position (a player with multiple `fantasy_positions`). The normalizer filters to this league's six actual positions before ranking; don't assume the raw fetch is already clean.
- `npm run sync:fixture` writes to the *same* `data/snapshot.json` as a real sync (only the raw-season path differs, to `data/fixture/raw`) — running it will overwrite real local data. Harmless, just re-run `npm run sync` afterward.
- Every modal/interactive UI change is verified with a real headless-browser script (Playwright, set up ad hoc in `/tmp`, not a committed dependency) taking screenshots at both a laptop and mobile viewport — curl/static-HTML checks alone aren't sufficient proof for client-side interactivity.

## 11. Not done yet

- Custom domain via Route 53, attached to the Amplify app.
- Real trophy names and lore content (bios, rules, punishments) from the owner.
- **Draft grades, trade grades, waiver wire value** — the data pipeline (section 5) is built and verified; the actual `defineStat()` modules and pages replacing the `/draft-grades`, `/trade-grades`, `/waiver-value` "coming soon" placeholders are not. Each would read `ctx.league.playerSeasonFinishes` (draft grades) or `playerWeeklyPoints` + `transactions` (trade/waiver), following the same `defineStat()` pattern as every existing stat module.
- **Power rankings, lineup efficiency, manager tendencies** — no new data pipeline needed (everything already exists in `LeagueHistory`), just the stat modules and pages. Currently "coming soon" placeholders at `/power-rankings`, `/lineup-efficiency`, `/manager-tendencies`.
- Nav is organized into three dropdown groups (This season / League / Moves) plus pinned Home and Records, with a matching mobile "More" sheet — see `apps/web/components/Nav.tsx`. New pages slot into an existing group.
