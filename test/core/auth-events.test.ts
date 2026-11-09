import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoopAuthEventRecorder, createPostgresAuthEventRecorder, createRuntimeAuthEventRecorder } from '@/lib/core/auth/auth-events';

describe('auth event recorder', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('lazily creates auth_events and retries when the table is missing', async () => {
    const calls: QueryCall[] = [];
    let failed = false;
    const client = {
      async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
        calls.push({ text: normalizeSql(text), params });
        if (!failed && /insert into auth_events/.test(text)) {
          failed = true;
          throw { code: '42P01', message: 'relation "auth_events" does not exist' };
        }
        return [] as T[];
      }
    };
    const recorder = createPostgresAuthEventRecorder({ client });

    await recorder.record({ userId: 'usr_1', type: 'login' });

    expect(calls[0]?.text).toContain('insert into auth_events');
    expect(calls[1]?.text).toContain('create table if not exists auth_events');
    expect(calls[2]?.text).toContain('insert into auth_events');
    expect(calls[2]?.params[1]).toBe('usr_1');
    expect(calls[2]?.params[2]).toBe('login');
  });

  it('records register events with metadata', async () => {
    const { client, calls } = createQueryClient();
    const recorder = createPostgresAuthEventRecorder({ client });

    await recorder.record({ userId: 'usr_2', type: 'register', metadata: { provider: 'marketplace' } });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain('insert into auth_events');
    expect(calls[0]?.params[1]).toBe('usr_2');
    expect(calls[0]?.params[2]).toBe('register');
    expect(calls[0]?.params[4]).toBe(JSON.stringify({ provider: 'marketplace' }));
  });

  it('uses a noop recorder when runtime has no database', async () => {
    const queryClientFactory = vi.fn();
    const recorder = createRuntimeAuthEventRecorder({
      MOCK_MODE: true,
      DATABASE_URL: 'postgres://example',
      queryClientFactory
    });

    await recorder.record({ userId: 'usr_3', type: 'login' });

    expect(queryClientFactory).not.toHaveBeenCalled();
  });

  it('noop recorder ignores events', async () => {
    await expect(createNoopAuthEventRecorder().record({ userId: 'usr_4', type: 'login' })).resolves.toBeUndefined();
  });
});

interface QueryCall {
  text: string;
  params: unknown[];
}

function createQueryClient(rowsByCall: unknown[][] = []) {
  const calls: QueryCall[] = [];
  return {
    calls,
    client: {
      async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
        calls.push({ text: normalizeSql(text), params });
        return (rowsByCall.shift() ?? []) as T[];
      }
    }
  };
}

function normalizeSql(text: string) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

