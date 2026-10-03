# Architecture & deployment reference

This document describes the full application stack as actually deployed, not just as designed.
It is a living reference for whoever (human or Claude) next touches infrastructure or deployment.
Update it whenever a resource, workflow step, or account-level setting changes.

## 1. Overview

A public static site for a 12-team Sleeper fantasy football league.
It shows standings, champions, records, rivalries, and manager profiles across the league's full history.
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
Sleeper API
   │
   ▼
sync Lambda (nightly, EventBridge-triggered)
   │  writes raw seasons + snapshot/latest.json
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
| `packages/core` | Typed Sleeper API client, history importer, normalizer (produces `LeagueHistory`), stat registry, fixture league generator, vitest tests |
| `apps/sync` | `runSync()`, shared by the CLI (`src/cli.ts`, local files) and the Lambda (`src/lambda.ts`, S3) |
| `apps/web` | Next.js 15 static export (Tailwind v4), reads `data/snapshot.json` at build time |
| `infra` | CDK stack in TypeScript (`lib/league-stack.ts`, entry `bin/app.ts`) |
| `content/league.config.json` | League ID, league name, manager identity overrides, trophy names, last-place rule |
| `amplify.yml` | Amplify Hosting build spec (repo root) |
| `.claude/architecture.md` | This file |

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
- Layout inside the bucket: `raw/<year>.json` (untouched Sleeper responses per season) and `snapshot/latest.json` (the derived, normalized snapshot the web app reads).

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
3. Otherwise call `runSync()`, which fetches every season from the current league back through `previous_league_id`, writes `raw/<year>.json` for each, and writes `snapshot/latest.json`.
4. Read the webhook URL from SSM and `POST` to it to trigger an Amplify rebuild.

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
- Grants S3 read scoped to `snapshot/*` only inside the data bucket — it cannot read `raw/*` or write anything.
- Attached to the Amplify app as its "service role," which is how the build container gets temporary AWS credentials for the `aws s3 cp` step in `amplify.yml`.

### CloudFormation outputs

`DataBucketName`, `SyncFunctionName`, `AmplifyBuildRoleArn`, `BuildHookParameter` — printed at the end of every `cdk deploy`, and the four values a human needs to wire up the Amplify console afterward.

## 5. Amplify Hosting (not managed by CDK)

Amplify Hosting itself is created and configured by hand in the AWS console, because connecting a GitHub repo requires an interactive OAuth/GitHub-App authorization that can't be scripted without a stored token.

- App name `fantasy-football-league-site`, App ID `d3tmi0z43d0yoo`.
- Connected to `RileyHeike/fantasy-football-league-site`, branch `master`.
- Build spec: the repo's own `amplify.yml` (not an auto-generated one).
- Environment variable: `DATA_BUCKET = leaguesite-data666c94c7-ddd6eugomj6j`.
- Service role: the `AmplifyBuildRoleArn` output above.
- Incoming webhook named `league-sync`, used exclusively by the sync Lambda to trigger rebuilds after a successful sync — there is no GitHub-push-triggered build in the normal nightly flow, since the repo's `master` branch doesn't change nightly.

`amplify.yml` build steps:
1. `npm ci`.
2. `aws s3 cp "s3://${DATA_BUCKET}/snapshot/latest.json" data/snapshot.json` — uses the attached service role's temporary credentials.
3. `npm run build` — builds `apps/web` and static-exports it.
4. Artifacts are `apps/web/out/**`.
5. Cache paths: `node_modules/**` and `apps/web/.next/cache/**`.

## 6. One-time account setup already completed

These steps are done and should not need repeating, but are recorded here since they involved manual console work outside of CDK.

1. **AWS IAM Identity Center (SSO)** enabled on the personal AWS account, with a single-account "organization."
   SSO start URL: `https://d-9267ccde7a.awsapps.com/start`, SSO region `us-west-2`.
   A user was created in Identity Center and assigned an `AdministratorAccess` permission set on the account.
   The local CLI profile is named `league-site` (`~/.aws/config`); deploys run with `export AWS_PROFILE=league-site`.
2. **Lambda concurrent-executions quota** was raised from the new-account default of 10 to the standard 1000 in `us-west-2`, because `reservedConcurrentExecutions: 1` on the sync function is impossible while the account-wide pool is at 10 (AWS requires at least 10 unreserved).
   This was a one-time AWS Support case, auto-resolved within the hour.
   It does not loosen any guardrail in the code — the function is still capped at 1 concurrent execution.
3. **Amplify app created and wired up** as described in section 5: GitHub connected, env var set, service role attached, webhook created.
4. **Webhook URL stored** in the `/league-site/amplify-build-hook` SSM parameter, overwriting CDK's `"unset"` placeholder.
   Re-running `cdk deploy` will not revert this value, since the parameter's value isn't part of the CDK-managed diff once set this way.
5. **Sync Lambda invoked manually once** (`aws lambda invoke --function-name <name>`) to load all history into S3 before the first real Amplify build, and once more after the webhook was stored, to confirm the full nightly chain works end to end.

## 7. Local development workflow

```bash
npm install
npm run sync:fixture   # generates a 7-season demo league, no network — data/snapshot.json
npm run sync           # real league, needs leagueId already set in content/league.config.json
npm test                # vitest, packages/core
npm run typecheck
npm run dev              # site at localhost:3000, reads data/snapshot.json
npm run build            # static export to apps/web/out
```

`infra` has its own `package.json` and is installed separately:

```bash
cd infra && npm install && npx cdk synth
```

`cdk synth` validates the stack and requires no AWS account or credentials.

## 8. Deploying infrastructure changes

Any change to `infra/lib/league-stack.ts` or `infra/cdk.json` needs a redeploy, run by the account owner with their own SSO session — never by an automated agent without explicit confirmation, since `cdk deploy` can change IAM and cost-relevant resources.

```bash
cd infra
export AWS_PROFILE=league-site
npx cdk diff      # see what would change, optional but recommended
npx cdk deploy    # prompts to confirm IAM-sensitive changes
```

If the SSO session has expired, run `aws sso login --profile league-site` first (opens a browser).

Changing the Amplify app's configuration (env vars, service role, build spec, webhook) is done in the Amplify console, not CDK — CDK only produces the `AmplifyBuildRoleArn` and `BuildHookParameter` the console step depends on.

## 9. Ongoing nightly operation

No manual action is needed for normal operation.
Every night at 9:00 AM UTC, EventBridge invokes the sync Lambda, which syncs Sleeper data to S3 and then triggers an Amplify rebuild via the webhook.
In the offseason, the Lambda still runs on the EventBridge schedule but exits immediately unless it's Tuesday, to avoid pointless rebuilds when nothing has changed.
A sync failure triggers a CloudWatch alarm and an email to `rileyheike@gmail.com`.
An Amplify build failure does not currently trigger any notification — it would need to be noticed by checking the Amplify console or the live site.

## 10. Known quirks worth remembering

- The very first Amplify build (job 1) failed with a 403 on the `aws s3 cp` step, because it ran before the service role was attached to the app.
  This was a one-time ordering artifact of initial setup, not a recurring issue — every build since has succeeded.
- 2020's last-place "toilet bowl" final was never scored in Sleeper (`losersBracket` entry has `w: null, l: null`).
  The normalizer (`packages/core/src/model/normalize.ts`, `computePlacements`) falls back to worst regular-season record (fewest wins, then fewest points) whenever the configured `lastPlaceRule` can't resolve a result from the bracket, so no completed season is ever left without a last-place manager.
- `lastPlaceRule` is currently `consolationFinalLoser` (the toilet-bowl loser), per the league's actual rule, confirmed by the owner.
- Trophy names in `content/league.config.json` are still the generic defaults (`"The Cup"`, `"The Wooden Spoon"`) — real names haven't been provided yet.
- The git remote's default branch is `master`, not `main` — Amplify is connected to `master`, so any future branch rename needs to update both GitHub's default branch and the Amplify branch connection together.
- `apps/web/next-env.d.ts` is intentionally committed; it's a Next.js convention, not an accidental build artifact.

## 11. Not done yet

- Custom domain via Route 53, attached to the Amplify app.
- Phase 2 pages: transactions (trades and waivers), draft boards, playoff bracket view, lore content from the owner.
- Phase 4 stats: lineup efficiency, power rankings, trade and draft grades, more charts.
- Real trophy names.
