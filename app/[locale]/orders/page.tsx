import { OrdersClient } from '@/components/orders-client';

export default async function OrdersPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <OrdersClient locale={locale} />;
}
