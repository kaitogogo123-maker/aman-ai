import { MockStorageProvider } from './mock-storage-provider';
import { createR2Client, presignR2GetUrl } from './r2-client';
import { R2StorageProvider, type S3LikeClient } from './r2-storage-provider';
import type { StorageProvider } from './types';

export interface StorageProviderFactoryInput {
  mockMode: boolean;
  r2: {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketUploads: string;
    publicBaseUrl?: string;
  };
  clientFactory?: (input: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) => S3LikeClient;
}

export function createStorageProvider(input: StorageProviderFactoryInput): StorageProvider {
  if (
    input.mockMode ||
    !input.r2.accountId ||
    !input.r2.accessKeyId ||
    !input.r2.secretAccessKey
  ) {
    return new MockStorageProvider();
  }

  const client = (input.clientFactory ?? createR2Client)({
    accountId: input.r2.accountId,
    accessKeyId: input.r2.accessKeyId,
    secretAccessKey: input.r2.secretAccessKey
  });

  return new R2StorageProvider({
    client,
    bucket: input.r2.bucketUploads,
    publicBaseUrl: input.r2.publicBaseUrl,
    presignGetUrl: presignR2GetUrl
  });
}
