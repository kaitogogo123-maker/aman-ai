import type { TaskStore } from './task-store';
import type { GenerationTask } from './types';

export interface QueryClient {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
}

interface PostgresTaskStoreDependencies {
  client: QueryClient;
}

interface TaskRow {
  payload: string | GenerationTask;
}

const CREATE_TABLE_SQL = `
  create table if not exists generation_tasks (
    id text primary key,
    device_id text not null,
    status text not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    payload jsonb not null
  )
`;

const UPSERT_TASK_SQL = `
  insert into generation_tasks (
    id,
    device_id,
    status,
    created_at,
    updated_at,
    payload
  )
  values ($1, $2, $3, $4, $5, $6::jsonb)
  on conflict (id) do update set
    device_id = excluded.device_id,
    status = excluded.status,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    payload = excluded.payload
`;

// 惰性建表:表已存在则稳态零 DDL(原来每请求都先跑 CREATE TABLE,低流量下每个新 isolate 都重跑,
// 多一次串行 Neon 往返,拖慢 history/task 轮询/生成)。仅当查询报「表不存在」才建表+重试一次。
let schemaReady: Promise<void> | undefined;

function isUndefinedTable(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === '42P01' || /does not exist/i.test(err?.message ?? '');
}

function withSchemaHeal(client: QueryClient): QueryClient {
  return {
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      try {
        return await client.query<T>(text, params);
      } catch (e) {
        if (!isUndefinedTable(e)) throw e;
        schemaReady ??= client.query(CREATE_TABLE_SQL).then(() => undefined).catch((err) => {
          schemaReady = undefined;
          throw err;
        });
        await schemaReady;
        return client.query<T>(text, params);
      }
    }
  };
}

export function createPostgresTaskStore({ client: rawClient }: PostgresTaskStoreDependencies): TaskStore {
  const client = withSchemaHeal(rawClient);

  async function persist(task: GenerationTask) {
    await client.query(UPSERT_TASK_SQL, [
      task.id,
      task.deviceId,
      task.status,
      task.createdAt,
      task.updatedAt,
      JSON.stringify(task)
    ]);
    return task;
  }

  return {
    create(task) {
      return persist(task);
    },

    async get(taskId) {
      const rows = await client.query<TaskRow>(
        `
          select payload
          from generation_tasks
          where id = $1
          limit 1
        `,
        [taskId]
      );

      return rows[0] ? parseTaskPayload(rows[0].payload) : null;
    },

    async update(task) {
      return persist({
        ...task,
        updatedAt: new Date().toISOString()
      });
    },

    async listByDevice(deviceId) {
      const rows = await client.query<TaskRow>(
        `
          select payload
          from generation_tasks
          where device_id = $1
          order by created_at desc
        `,
        [deviceId]
      );

      return rows.map((row) => parseTaskPayload(row.payload));
    },

    // 按用户归属查(userId 存于 payload JSONB,免去 ALTER 线上表)
    async listByUser(userId) {
      const rows = await client.query<TaskRow>(
        `
          select payload
          from generation_tasks
          where payload->>'userId' = $1
          order by created_at desc
        `,
        [userId]
      );

      return rows.map((row) => parseTaskPayload(row.payload));
    },

    async remove(taskId) {
      await client.query(`delete from generation_tasks where id = $1`, [taskId]);
    }
  };
}

function parseTaskPayload(payload: string | GenerationTask): GenerationTask {
  return typeof payload === 'string' ? (JSON.parse(payload) as GenerationTask) : payload;
}
