import { AdminAccountingClient } from '@/components/admin-accounting-client';

// 内部后台:不带 URL 语言前缀(/admin/accounting),不套营销站外壳(root layout 仅 html/body)。
// 语言由客户端按浏览器/系统语言自动选(默认英文)。
export const dynamic = 'force-dynamic';

export default function AdminAccountingPage() {
  return (
    <main className="admin-page">
      <AdminAccountingClient />
    </main>
  );
}
