import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export interface R2Config {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  /** Public base URL of the bucket (custom domain or r2.dev), no trailing slash. */
  publicBaseUrl?: string;
  /** Override for the S3 endpoint (tests, other S3-compatible stores). */
  endpoint?: string;
}

/**
 * Cloudflare R2 object storage (S3 API). Optional: when R2_* is not set,
 * `isConfigured` is false and callers fall back to inline storage.
 */
@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly config: R2Config;
  private client: S3Client | null = null;

  constructor(configService: ConfigService) {
    this.config = configService.get<R2Config>('r2') ?? {};
    if (!this.isConfigured) {
      this.logger.warn(
        'R2 is not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL); scraped images are stored inline in MongoDB',
      );
    }
  }

  get isConfigured(): boolean {
    const c = this.config;
    return !!(
      (c.accountId || c.endpoint) &&
      c.accessKeyId &&
      c.secretAccessKey &&
      c.bucket &&
      c.publicBaseUrl
    );
  }

  private get s3(): S3Client {
    if (!this.client) {
      const c = this.config;
      this.client = new S3Client({
        region: 'auto',
        endpoint:
          c.endpoint || `https://${c.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: c.accessKeyId!,
          secretAccessKey: c.secretAccessKey!,
        },
      });
    }
    return this.client;
  }

  publicUrl(key: string): string {
    return `${this.config.publicBaseUrl!.replace(/\/+$/, '')}/${key}`;
  }

  /** Uploads and returns the public URL. */
  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return this.publicUrl(key);
  }

  /** Best effort: logs and swallows failures (orphans are harmless). */
  async deleteMany(keys: string[]): Promise<void> {
    const unique = [...new Set(keys.filter(Boolean))];
    if (!unique.length || !this.isConfigured) return;
    try {
      for (let i = 0; i < unique.length; i += 1000) {
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.config.bucket,
            Delete: {
              Objects: unique.slice(i, i + 1000).map((Key) => ({ Key })),
              Quiet: true,
            },
          }),
        );
      }
    } catch (error) {
      this.logger.warn(
        `R2 delete failed for ${unique.length} object(s): ${(error as Error).message}`,
      );
    }
  }
}
