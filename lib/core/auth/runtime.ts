import { getRuntimeEnv, type AppEnv } from '@/lib/config/env';
import { createRuntimeAuthStore } from './auth-store-factory';
import { createSandboxSmsSender } from './sms';
import { createAuthService, type AuthService } from './service';

export function createRuntimeAuthService(runtimeEnv: AppEnv = getRuntimeEnv()): AuthService {
  return createAuthService({
    store: createRuntimeAuthStore({
      mockMode: runtimeEnv.MOCK_MODE,
      databaseUrl: runtimeEnv.DATABASE_URL
    }),
    // 阶段 1 仅 sandbox 发送;阶段 3 接客户短信网关后在此切换真实 sender
    sms: createSandboxSmsSender(),
    sessionSecret: runtimeEnv.AUTH_SECRET,
    exposeOtp: runtimeEnv.AUTH_SMS_SANDBOX
  });
}
