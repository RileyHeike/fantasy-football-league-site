import { S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { HttpTransport, SleeperClient, type LeagueConfig } from "@league/core";
import { S3RawStore, S3SnapshotStore } from "./s3Store";
import { runSync } from "./sync";
import config from "../../../content/league.config.json";

/**
 * Lambda entry point, invoked nightly by EventBridge Scheduler.
 * Env: DATA_BUCKET, BUILD_HOOK_PARAM (SSM name holding the Amplify webhook URL).
 */
export async function handler() {
  const bucket = required("DATA_BUCKET");
  const s3 = new S3Client({});
  const client = new SleeperClient(new HttpTransport());

  // Nightly in season; weekly (Tuesdays) in the offseason.
  const state = await client.nflState();
  const inSeason = state.season_type === "regular" || state.season_type === "post";
  if (!inSeason && new Date().getUTCDay() !== 2) {
    console.log(`offseason (${state.season_type}), skipping until Tuesday`);
    return { ok: true, skipped: true };
  }

  await runSync({
    client,
    raw: new S3RawStore(s3, bucket),
    snapshots: new S3SnapshotStore(s3, bucket),
    config: config as LeagueConfig,
  });

  const param = process.env.BUILD_HOOK_PARAM;
  if (param) {
    const ssm = new SSMClient({});
    const hook = await ssm.send(new GetParameterCommand({ Name: param, WithDecryption: true }));
    const url = hook.Parameter?.Value;
    if (url) {
      const res = await fetch(url, { method: "POST" });
      console.log(`build hook: ${res.status}`);
    }
  }
  return { ok: true };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}
