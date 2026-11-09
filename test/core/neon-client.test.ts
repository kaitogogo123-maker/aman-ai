import { beforeEach, describe, expect, it, vi } from 'vitest';

const events: unknown[][] = [];

// HTTP 驱动:neon(url) 返回带 query 方法的函数;query 直接返回 rows 数组
vi.mock('@neondatabase/serverless', () => ({
  neon: (databaseUrl: string) => {
    events.push(['neon', databaseUrl]);
    return {
      query: async (text: string, params: unknown[]) => {
        events.push(['query', text, params]);
        return [{ id: 'row_1' }];
      }
    };
  }
}));

describe('createNeonQueryClient', () => {
  beforeEach(() => {
    events.length = 0;
  });

  it('uses the Neon HTTP driver and returns rows', async () => {
    const { createNeonQueryClient } = await import('@/lib/core/db/neon-client');
    const client = createNeonQueryClient('postgres://neon.example/tamga');

    const rows = await client.query<{ id: string }>('select * from generation_tasks where id = $1', ['task_1']);

    expect(rows).toEqual([{ id: 'row_1' }]);
    expect(events).toEqual([
      ['neon', 'postgres://neon.example/tamga'],
      ['query', 'select * from generation_tasks where id = $1', ['task_1']]
    ]);
  });
});
