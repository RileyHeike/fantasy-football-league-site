import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { LeagueSnapshot, RawSeason, RawSeasonStore, SnapshotStore } from "@league/core";

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
