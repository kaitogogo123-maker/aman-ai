import { HistoryClient } from '@/components/history-client';

export default async function HistoryPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <HistoryClient locale={locale} initialTasks={[]} initialLoading />;
}
