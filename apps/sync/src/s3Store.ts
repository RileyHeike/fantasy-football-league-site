import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type {
  LeagueSnapshot,
  PlayerStatsStore,
  PlayerWeeklyStore,
  RawSeason,
  RawSeasonStore,
  SleeperPlayerStatLine,
  SnapshotStore,
} from "@league/core";

/** S3 layout: raw/<season>.json and snapshot/latest.json in one bucket. */
export class S3RawStore implements RawSeasonStore {
  constructor(private readonly s3: S3Client, private readonly bucket: string) {}
  async loadAll(): Promise<RawSeason[]> {
    const list = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: "raw/" }));
    return Promise.all(
      (list.Contents ?? []).map(async (o) => {
        const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: o.Key! }));
        return JSON.parse(await res.Body!.transformToString()) as RawSeason;
      }),
    );
  }
  async save(s: RawSeason) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `raw/${s.league.season}.json`,
        Body: JSON.stringify(s),
        ContentType: "application/json",
      }),
    );
  }
}

export class S3SnapshotStore implements SnapshotStore {
  constructor(private readonly s3: S3Client, private readonly bucket: string, private readonly key = "snapshot/latest.json") {}
  async load() {
    try {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key }));
      return JSON.parse(await res.Body!.transformToString()) as LeagueSnapshot;
    } catch {
      return null;
    }
  }
  async save(s: LeagueSnapshot) {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: this.key, Body: JSON.stringify(s), ContentType: "application/json" }),
    );
  }
}

/** S3 layout: playerStats/<season>.json. */
export class S3PlayerStatsStore implements PlayerStatsStore {
  constructor(private readonly s3: S3Client, private readonly bucket: string) {}
  async loadAll(): Promise<Record<number, SleeperPlayerStatLine[]>> {
    const list = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: "playerStats/" }));
    const entries = await Promise.all(
      (list.Contents ?? []).map(async (o) => {
        const season = Number(o.Key!.replace("playerStats/", "").replace(".json", ""));
        const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: o.Key! }));
        return [season, JSON.parse(await res.Body!.transformToString()) as SleeperPlayerStatLine[]] as const;
      }),
    );
    return Object.fromEntries(entries);
  }
  async save(season: number, lines: SleeperPlayerStatLine[]) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `playerStats/${season}.json`,
        Body: JSON.stringify(lines),
        ContentType: "application/json",
      }),
    );
  }
}

/** S3 layout: playerWeekly/<playerId>-<season>.json. */
export class S3PlayerWeeklyStore implements PlayerWeeklyStore {
  constructor(private readonly s3: S3Client, private readonly bucket: string) {}
  async loadAll(): Promise<Record<string, Record<string, SleeperPlayerStatLine>>> {
    const list = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: "playerWeekly/" }));
    const entries = await Promise.all(
      (list.Contents ?? []).map(async (o) => {
        const key = o.Key!.replace("playerWeekly/", "").replace(".json", "");
        const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: o.Key! }));
        return [key, JSON.parse(await res.Body!.transformToString()) as Record<string, SleeperPlayerStatLine>] as const;
      }),
    );
    return Object.fromEntries(entries);
  }
  async save(playerId: string, season: number, weeks: Record<string, SleeperPlayerStatLine>) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `playerWeekly/${playerId}-${season}.json`,
        Body: JSON.stringify(weeks),
        ContentType: "application/json",
      }),
    );
  }
}
