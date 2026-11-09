import { AuthFlow } from '@/components/auth-flow';

export default async function RecoverPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AuthFlow locale={locale} mode="recover" />;
}
