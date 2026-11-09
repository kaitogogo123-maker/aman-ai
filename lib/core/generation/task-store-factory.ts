import { createNeonQueryClient } from '@/lib/core/db/neon-client';
import { createPostgresTaskStore, type QueryClient } from './postgres-task-store';
import { createMemoryTaskStore, type TaskStore } from './task-store';

export interface RuntimeTaskStoreConfig {
  mockMode: boolean;
  databaseUrl?: string;
  queryClientFactory?: (databaseUrl: string) => QueryClient;
}

export function createRuntimeTaskStore({
  mockMode,
  databaseUrl,
  queryClientFactory = createNeonQueryClient
}: RuntimeTaskStoreConfig): TaskStore {
  const trimmedDatabaseUrl = databaseUrl?.trim();

  if (!mockMode && trimmedDatabaseUrl) {
    return createPostgresTaskStore({
      client: queryClientFactory(trimmedDatabaseUrl)
    });
  }

  return createMemoryTaskStore();
}
