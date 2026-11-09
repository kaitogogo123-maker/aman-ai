import { NextRequest, NextResponse } from 'next/server';
import { createRuntimePaymentService } from '@/lib/core/payment/runtime';
import { paymentErrorStatus } from '@/lib/core/payment/service';

export async function POST(request: NextRequest) {
  const result = await createRuntimePaymentService().handleCallback({
    headers: request.headers,
    body: await request.json().catch(() => null)
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: paymentErrorStatus(result.error) });
  }

  return NextResponse.json({ ok: true, balance: result.balance });
}
