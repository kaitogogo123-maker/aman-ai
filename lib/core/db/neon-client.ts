import { neon } from '@neondatabase/serverless';
import type { QueryClient } from '@/lib/core/generation/postgres-task-store';

// Neon HTTP 驱动:每次 query 为单次无状态 HTTP 请求,取代旧 Client(每查询 connect/end 一次 TCP,
// serverless 下多次往返、显著变慢 —— 即「获取短信/登录迟钝」根因)。
// neon(url).query(text, params) 默认返回 rows 数组(fullResults=false),与旧 result.rows 同结构。
export function createNeonQueryClient(databaseUrl: string): QueryClient {
  const sql = neon(databaseUrl);
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const rows = await sql.query(text, params as (string | number | boolean | null)[]);
      return rows as T[];
    }
  };
}
