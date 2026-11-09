import { describe, expect, it } from 'vitest';
import { createRuntimeTaskStore } from '@/lib/core/generation/task-store-factory';
import type { GenerationTask } from '@/lib/core/generation/types';

describe('createRuntimeTaskStore', () => {
  it('uses memory storage in mock mode without creating a database client', async () => {
    const store = createRuntimeTaskStore({
      mockMode: true,
      databaseUrl: 'postgres://example',
      queryClientFactory: () => {
        throw new Error('database client should not be created in mock mode');
      }
    });
    const task = createTask();

    await store.create(task);

    await expect(store.get(task.id)).resolves.toEqual(task);
  });

  it('uses postgres storage in real mode when DATABASE_URL exists', async () => {
    const calls: { databaseUrl: string }[] = [];
    const queries: { text: string; params: unknown[] }[] = [];
    const store = createRuntimeTaskStore({
      mockMode: false,
      databaseUrl: 'postgres://neon.example/tamga',
      queryClientFactory(databaseUrl) {
        calls.push({ databaseUrl });
        return {
          async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
            queries.push({ text: text.replace(/\s+/g, ' ').trim().toLowerCase(), params });
            return [] as T[];
          }
        };
      }
    });

    await store.create(createTask());

    expect(calls).toEqual([{ databaseUrl: 'postgres://neon.example/tamga' }]);
    // 惰性建表:表已存在(mock 查询不报错)→ 不跑 CREATE TABLE,直接 insert
    expect(queries).toHaveLength(1);
    expect(queries[0]?.text).toContain('insert into generation_tasks');
  });
});

function createTask(): GenerationTask {
  return {
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
}
