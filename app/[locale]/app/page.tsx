import { TamgaApp } from '@/components/tamga-app';

export default async function AppPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TamgaApp locale={locale} />;
}
