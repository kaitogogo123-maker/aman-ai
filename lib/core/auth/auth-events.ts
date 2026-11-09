import { getRuntimeEnv } from '@/lib/config/env';
import { createNeonQueryClient } from '@/lib/core/db/neon-client';
import type { QueryClient } from '@/lib/core/generation/postgres-task-store';

export type AuthEventType = 'login' | 'register';

export interface AuthEventRecorder {
  record(event: { userId: string; type: AuthEventType; metadata?: Record<string, unknown> }): Promise<void>;
}

export interface RuntimeAuthEventConfig {
  MOCK_MODE: boolean;
  DATABASE_URL?: string;
  queryClientFactory?: (databaseUrl: string) => QueryClient;
}

const CREATE_AUTH_EVENTS_SQL = `
  create table if not exists auth_events (
    id text primary key,
    user_id text not null,
    type text not null,
    created_at timestamptz not null,
    metadata jsonb not null default '{}'::jsonb
  )
`;

let schemaReady: Promise<void> | undefined;

export function createRuntimeAuthEventRecorder(
  config: RuntimeAuthEventConfig = {
    MOCK_MODE: getRuntimeEnv().MOCK_MODE,
    DATABASE_URL: getRuntimeEnv().DATABASE_URL
  }
): AuthEventRecorder {
  const trimmed = config.DATABASE_URL?.trim();
  if (config.MOCK_MODE || !trimmed) return createNoopAuthEventRecorder();
  return createPostgresAuthEventRecorder({
    client: (config.queryClientFactory ?? createNeonQueryClient)(trimmed)
  });
}

export function createNoopAuthEventRecorder(): AuthEventRecorder {
  return {
    async record() {
      return undefined;
    }
  };
}

export function createPostgresAuthEventRecorder({ client: rawClient }: { client: QueryClient }): AuthEventRecorder {
  const client = withSchemaHeal(rawClient);

  return {
    async record(event) {
      await client.query(
        `insert into auth_events (id, user_id, type, created_at, metadata)
         values ($1,$2,$3,$4,$5::jsonb)`,
        [
          `evt_${crypto.randomUUID()}`,
          event.userId,
          event.type,
          new Date().toISOString(),
          JSON.stringify(event.metadata ?? {})
        ]
      );
    }
  };
}

function withSchemaHeal(client: QueryClient): QueryClient {
  return {
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      try {
        return await client.query<T>(text, params);
      } catch (e) {
        if (!isUndefinedTable(e)) throw e;
        schemaReady ??= client.query(CREATE_AUTH_EVENTS_SQL).then(() => undefined).catch((err) => {
          schemaReady = undefined;
          throw err;
        });
        await schemaReady;
        return client.query<T>(text, params);
      }
    }
  };
}

function isUndefinedTable(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === '42P01' || /does not exist/i.test(err?.message ?? '');
}

