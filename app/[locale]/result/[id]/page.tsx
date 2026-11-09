import { ResultViewClient } from '@/components/result-view-client';

export default async function ResultPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<{ count?: string }>;
}) {
  const { locale, id } = await params;
  const query = await searchParams;
  return <ResultViewClient locale={locale} taskId={id} expectedImages={readExpectedImages(query?.count)} />;
}

function readExpectedImages(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
}
