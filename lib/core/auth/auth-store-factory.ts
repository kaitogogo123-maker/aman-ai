import { createNeonQueryClient } from '@/lib/core/db/neon-client';
import type { QueryClient } from '@/lib/core/generation/postgres-task-store';
import { createMemoryAuthStore, type AuthStore } from './auth-store';
import { createPostgresAuthStore } from './postgres-auth-store';

export interface RuntimeAuthStoreConfig {
  mockMode: boolean;
  databaseUrl?: string;
  queryClientFactory?: (databaseUrl: string) => QueryClient;
}

export function createRuntimeAuthStore({
  mockMode,
  databaseUrl,
  queryClientFactory = createNeonQueryClient
}: RuntimeAuthStoreConfig): AuthStore {
  const trimmed = databaseUrl?.trim();
  if (!mockMode && trimmed) {
    return createPostgresAuthStore({ client: queryClientFactory(trimmed) });
  }
  return createMemoryAuthStore();
}
