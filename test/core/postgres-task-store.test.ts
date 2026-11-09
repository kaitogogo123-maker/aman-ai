import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationTask } from '@/lib/core/generation/types';

// schema 缓存现为模块级(prod 正确:建表只跑一次/isolate)。测试需隔离:
// 每个用例 resetModules + 动态 import,拿到全新模块(各自重跑 CREATE TABLE),避免序列错位。
async function loadFactory() {
  return (await import('@/lib/core/generation/postgres-task-store')).createPostgresTaskStore;
}

describe('createPostgresTaskStore', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('persists without any DDL when the table already exists (惰性:稳态零建表)', async () => {
    const { client, calls } = createQueryClient();
    const createPostgresTaskStore = await loadFactory();
    const store = createPostgresTaskStore({ client });
    const task = createTask();

    await store.create(task);

    // 表已存在 → 不跑 CREATE TABLE,直接 insert(只 1 次查询)
    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain('insert into generation_tasks');
    expect(calls[0]?.params).toEqual([
      task.id,
      task.deviceId,
      task.status,
      task.createdAt,
      task.updatedAt,
      JSON.stringify(task)
    ]);
  });

  it('lazily creates the schema and retries only when the table is missing', async () => {
    const calls: QueryCall[] = [];
    let failed = false;
    const client = {
      async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
        calls.push({ text: normalizeSql(text), params });
        if (!failed && /insert into generation_tasks/.test(text)) {
          failed = true;
          throw { code: '42P01', message: 'relation "generation_tasks" does not exist' };
        }
        return [] as T[];
      }
    };
    const createPostgresTaskStore = await loadFactory();
    const store = createPostgresTaskStore({ client });

    await store.create(createTask());

    // 顺序:insert(报表不存在) → create table → insert(重试成功)
    expect(calls[0]?.text).toContain('insert into generation_tasks');
    expect(calls[1]?.text).toContain('create table if not exists generation_tasks');
    expect(calls[2]?.text).toContain('insert into generation_tasks');
  });

  it('returns a task from the stored JSON payload', async () => {
    const task = createTask();
    const { client } = createQueryClient([[{ payload: JSON.stringify(task) }]]);
    const createPostgresTaskStore = await loadFactory();
    const store = createPostgresTaskStore({ client });

    await expect(store.get(task.id)).resolves.toEqual(task);
  });

  it('updates the task timestamp and persists the new payload', async () => {
    const { client, calls } = createQueryClient();
    const createPostgresTaskStore = await loadFactory();
    const store = createPostgresTaskStore({ client });
    const task = createTask();

    const updated = await store.update({ ...task, status: 'running' });

    expect(updated.status).toBe('running');
    expect(updated.updatedAt).not.toBe(task.updatedAt);
    expect(calls.at(-1)?.text).toContain('insert into generation_tasks');
    expect(calls.at(-1)?.params.at(2)).toBe('running');
    expect(JSON.parse(calls.at(-1)?.params.at(5) as string)).toEqual(updated);
  });

  it('lists device tasks using the stored payloads', async () => {
    const newer = createTask({ id: 'task_newer', createdAt: '2026-01-02T00:00:00.000Z' });
    const older = createTask({ id: 'task_older', createdAt: '2026-01-01T00:00:00.000Z' });
    const { client, calls } = createQueryClient([
      [
        { payload: JSON.stringify(newer) },
        { payload: older }
      ]
    ]);
    const createPostgresTaskStore = await loadFactory();
    const store = createPostgresTaskStore({ client });

    await expect(store.listByDevice('device_1')).resolves.toEqual([newer, older]);

    expect(calls.at(-1)?.text).toContain('where device_id = $1');
    expect(calls.at(-1)?.text).toContain('order by created_at desc');
    expect(calls.at(-1)?.params).toEqual(['device_1']);
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

function createTask(overrides: Partial<GenerationTask> = {}): GenerationTask {
  const base: GenerationTask = {
    id: 'task_1',
    deviceId: 'device_1',
    sourceImageUrl: 'https://example.com/source.png',
    status: 'queued',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: {
      productInfo: 'Portable heater',
      model: 'nano-banana-2',
      resolution: '1k',
      aspectRatio: '1:1',
      outputLanguage: 'ru',
      fontStyle: 'auto',
      totalImages: 1,
      imageTypes: [{ kind: 'selling', count: 1 }]
    },
    items: [
      {
        id: 'item_1',
        kind: 'selling',
        index: 0,
        status: 'queued'
      }
    ]
  };

  return { ...base, ...overrides };
}

function normalizeSql(text: string) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
