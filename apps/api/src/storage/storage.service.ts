import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join, dirname } from "path";
import { Readable } from "stream";
import * as Minio from "minio";

/**
 * Object storage, S3-shaped. Phase 13: a real MinIO driver (used when
 * MINIO_ENDPOINT is set) with presigned browser-direct uploads. Falls back to a
 * local-disk driver when MinIO isn't configured (CI/e2e), so nothing breaks
 * without it. Production MinIO is provisioned on the VPS in Phase 17.
 */
export interface PutResult {
  bucket: string;
  storageKey: string;
}

export interface StorageDriver {
  put(bucket: string, key: string, body: Buffer, contentType: string): Promise<void>;
  get(bucket: string, key: string): Promise<Buffer>;
  urlFor(bucket: string, key: string): string | null;
  ensureBucket?(bucket: string): Promise<void>;
  presignedPut?(bucket: string, key: string, expirySec: number): Promise<string>;
  presignedGet?(bucket: string, key: string, expirySec: number): Promise<string>;
  stat?(bucket: string, key: string): Promise<{ size: number } | null>;
  head?(bucket: string, key: string, bytes: number): Promise<Buffer>; // first N bytes (type sniffing)
}

function collect(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/** Dev/CI driver: writes objects to local disk mirroring bucket/key layout. */
class LocalDiskDriver implements StorageDriver {
  constructor(private readonly rootDir: string) {}
  private pathFor(bucket: string, key: string) {
    return join(this.rootDir, bucket, key);
  }
  async put(bucket: string, key: string, body: Buffer): Promise<void> {
    const path = this.pathFor(bucket, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }
  async get(bucket: string, key: string): Promise<Buffer> {
    return readFile(this.pathFor(bucket, key));
  }
  async head(bucket: string, key: string, bytes: number): Promise<Buffer> {
    return (await this.get(bucket, key)).subarray(0, bytes);
  }
  urlFor(): string | null {
    return null; // streamed via GET /uploads/:id/file
  }
}

/** Real MinIO (S3-compatible) driver. */
class MinioDriver implements StorageDriver {
  constructor(private readonly client: Minio.Client) {}
  async ensureBucket(bucket: string): Promise<void> {
    if (!(await this.client.bucketExists(bucket).catch(() => false))) {
      await this.client.makeBucket(bucket);
    }
  }
  async put(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(bucket, key, body, body.length, { "Content-Type": contentType });
  }
  async get(bucket: string, key: string): Promise<Buffer> {
    return collect(await this.client.getObject(bucket, key));
  }
  async head(bucket: string, key: string, bytes: number): Promise<Buffer> {
    return collect(await this.client.getPartialObject(bucket, key, 0, bytes));
  }
  urlFor(): string | null {
    return null; // downloads stream through the API (auth-checked); presignedGet is separate
  }
  presignedPut(bucket: string, key: string, expirySec: number): Promise<string> {
    return this.client.presignedPutObject(bucket, key, expirySec);
  }
  presignedGet(bucket: string, key: string, expirySec: number): Promise<string> {
    return this.client.presignedGetObject(bucket, key, expirySec);
  }
  async stat(bucket: string, key: string): Promise<{ size: number } | null> {
    return this.client.statObject(bucket, key).then((s) => ({ size: s.size })).catch(() => null);
  }
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger("StorageService");
  readonly defaultBucket: string;
  readonly backend: "minio" | "local";
  private readonly driver: StorageDriver;

  constructor(config: ConfigService) {
    this.defaultBucket = config.get<string>("STORAGE_BUCKET", "tuba-docs");
    const endpoint = config.get<string>("MINIO_ENDPOINT");
    if (endpoint) {
      const client = new Minio.Client({
        endPoint: endpoint,
        port: Number(config.get<string>("MINIO_PORT", "9000")),
        useSSL: config.get<string>("MINIO_USE_SSL") === "true",
        accessKey: config.get<string>("MINIO_ACCESS_KEY", "minioadmin"),
        secretKey: config.get<string>("MINIO_SECRET_KEY", "minioadmin"),
      });
      this.driver = new MinioDriver(client);
      this.backend = "minio";
    } else {
      this.driver = new LocalDiskDriver(config.get<string>("STORAGE_DIR", "./uploads"));
      this.backend = "local";
    }
  }

  async onModuleInit() {
    if (this.driver.ensureBucket) {
      await this.driver.ensureBucket(this.defaultBucket).catch((e) =>
        this.log.error(`MinIO bucket ensure failed: ${(e as Error).message}`),
      );
    }
    this.log.log(`storage backend: ${this.backend} (bucket ${this.defaultBucket})`);
  }

  /** Deterministic key: {yyyy}/{mm}/{random}-{safe-filename}. */
  keyFor(fileName: string): string {
    const now = new Date();
    const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${randomBytes(8).toString("hex")}-${safe}`;
  }

  async store(fileName: string, body: Buffer, contentType: string): Promise<PutResult> {
    const key = this.keyFor(fileName);
    await this.driver.put(this.defaultBucket, key, body, contentType);
    return { bucket: this.defaultBucket, storageKey: key };
  }

  read(bucket: string, key: string): Promise<Buffer> {
    return this.driver.get(bucket, key);
  }

  headBytes(bucket: string, key: string, bytes = 4100): Promise<Buffer> {
    return this.driver.head ? this.driver.head(bucket, key, bytes) : this.read(bucket, key).then((b) => b.subarray(0, bytes));
  }

  urlFor(bucket: string, key: string): string | null {
    return this.driver.urlFor(bucket, key);
  }

  // ── Presigned direct browser upload (MinIO only) ─────────────────────────────
  get supportsPresigned() {
    return !!this.driver.presignedPut;
  }
  async presignedUpload(fileName: string, expirySec = 600): Promise<{ url: string; bucket: string; storageKey: string }> {
    const key = this.keyFor(fileName);
    if (!this.driver.presignedPut) throw new Error("presigned upload requires MinIO");
    const url = await this.driver.presignedPut(this.defaultBucket, key, expirySec);
    return { url, bucket: this.defaultBucket, storageKey: key };
  }
  presignedDownload(bucket: string, key: string, expirySec = 300): Promise<string> {
    if (!this.driver.presignedGet) throw new Error("presigned download requires MinIO");
    return this.driver.presignedGet(bucket, key, expirySec);
  }
  stat(bucket: string, key: string): Promise<{ size: number } | null> {
    return this.driver.stat ? this.driver.stat(bucket, key) : this.read(bucket, key).then((b) => ({ size: b.length })).catch(() => null);
  }
}
