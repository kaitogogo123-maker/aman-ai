import { getRuntimeEnv, type AppEnv } from '@/lib/config/env';
import { createRuntimeAuthService } from '@/lib/core/auth/runtime';
import { createPaymentService } from './service';

export function createRuntimePaymentService(runtimeEnv: AppEnv = getRuntimeEnv()) {
  const auth = createRuntimeAuthService(runtimeEnv);
  return createPaymentService({
    baseUrl: runtimeEnv.APP_BASE_URL,
    provider: runtimeEnv.PAYMENT_PROVIDER,
    creditWallet: (userId, amount) => auth.topup(userId, amount)
  });
}
