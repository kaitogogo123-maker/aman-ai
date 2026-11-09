import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { StorageProvider, UploadProductImageInput, UploadedObject } from './types';

export interface S3LikeClient {
  send(command: { input: unknown }): Promise<unknown>;
}

export interface R2StorageProviderOptions {
  client: S3LikeClient;
  bucket: string;
  publicBaseUrl?: string;
  presignGetUrl: (client: S3LikeClient, command: GetObjectCommand) => Promise<string>;
}

export class R2StorageProvider implements StorageProvider {
  private readonly client: S3LikeClient;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;
  private readonly presignGetUrl: (client: S3LikeClient, command: GetObjectCommand) => Promise<string>;

  constructor(options: R2StorageProviderOptions) {
    this.client = options.client;
    this.bucket = options.bucket;
    this.publicBaseUrl = options.publicBaseUrl?.replace(/\/$/, '');
    this.presignGetUrl = options.presignGetUrl;
  }

  async uploadProductImage(input: UploadProductImageInput): Promise<UploadedObject> {
    const key = `uploads/${safePathSegment(input.deviceId)}/${crypto.randomUUID()}-${slugFileName(input.fileName)}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType
      })
    );

    return {
      key,
      url: this.publicBaseUrl
        ? `${this.publicBaseUrl}/${key}`
        : await this.presignGetUrl(
            this.client,
            new GetObjectCommand({
              Bucket: this.bucket,
              Key: key
            })
          ),
      provider: 'r2'
    };
  }
}

function safePathSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'anonymous';
}

function slugFileName(fileName: string): string {
  const normalized = fileName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]+/g, '');
  const fallback = normalized || 'upload.png';
  const extension = fallback.includes('.') ? fallback.split('.').pop() : 'png';
  const base = fallback.includes('.') ? fallback.slice(0, fallback.lastIndexOf('.')) : fallback;
  return `${base.slice(0, 80) || 'upload'}.${extension || 'png'}`;
}
