import { TaskStatusClient } from '@/components/task-status-client';

export default async function TaskPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<{ count?: string }>;
}) {
  const { locale, id } = await params;
  const query = await searchParams;
  return <TaskStatusClient locale={locale} taskId={id} expectedImages={readExpectedImages(query?.count)} />;
}

function readExpectedImages(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
}
