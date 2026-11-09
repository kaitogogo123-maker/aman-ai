import { AuthFlow } from '@/components/auth-flow';

export default async function LoginPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AuthFlow locale={locale} mode="login" />;
}
