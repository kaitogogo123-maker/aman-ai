import { getRuntimeEnv, type AppEnv } from '@/lib/config/env';
import { createStorageProvider } from './provider-factory';

export function createRuntimeStorageProvider(runtimeEnv: AppEnv = getRuntimeEnv()) {
  return createStorageProvider({
    mockMode: runtimeEnv.MOCK_MODE,
    r2: {
      accountId: runtimeEnv.R2_ACCOUNT_ID,
      accessKeyId: runtimeEnv.R2_ACCESS_KEY_ID,
      secretAccessKey: runtimeEnv.R2_SECRET_ACCESS_KEY,
      bucketUploads: runtimeEnv.R2_BUCKET_UPLOADS,
      publicBaseUrl: runtimeEnv.R2_PUBLIC_URL
    }
  });
}
