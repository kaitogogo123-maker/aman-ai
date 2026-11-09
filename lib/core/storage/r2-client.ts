import { GetObjectCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { S3LikeClient } from './r2-storage-provider';

export interface CreateR2ClientInput {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function createR2Client(input: CreateR2ClientInput): S3LikeClient {
  const config: S3ClientConfig = {
    region: 'auto',
    endpoint: `https://${input.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: input.accessKeyId,
      secretAccessKey: input.secretAccessKey
    }
  };

  return new S3Client(config);
}

export async function presignR2GetUrl(client: S3LikeClient, command: GetObjectCommand) {
  return getSignedUrl(client as S3Client, command, { expiresIn: 60 * 60 });
}
