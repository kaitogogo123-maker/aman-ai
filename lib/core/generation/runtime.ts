import { getRuntimeEnv, type AppEnv } from '@/lib/config/env';
import { createFalClient } from './fal-client';
import { createGenerationProvider } from './provider-factory';
import { createGenerationService } from './service';
import { createRuntimeTaskStore } from './task-store-factory';
import { createMemoryTaskStore, type TaskStore } from './task-store';
import { createRuntimeTranslator } from '@/lib/core/translation/runtime';

declare global {
  var __tamgaMemoryTaskStore: TaskStore | undefined;
}

export function createRuntimeGenerationService(runtimeEnv: AppEnv = getRuntimeEnv()) {
  return createGenerationService({
    taskStore: createTaskStore(runtimeEnv),
    provider: createGenerationProvider({
      mockMode: runtimeEnv.MOCK_MODE,
      falKey: runtimeEnv.FAL_KEY,
      falClientFactory: createFalClient
    }),
    translator: createTaskTranslator(runtimeEnv)
  });
}

function createTaskTranslator(runtimeEnv: AppEnv) {
  if (runtimeEnv.MOCK_MODE || !runtimeEnv.ALI_DASHSCOPE_KEY) {
    return undefined;
  }

  return createRuntimeTranslator(runtimeEnv);
}

function createTaskStore(runtimeEnv: AppEnv): TaskStore {
  if (runtimeEnv.MOCK_MODE || !runtimeEnv.DATABASE_URL) {
    const taskStore = globalThis.__tamgaMemoryTaskStore ?? createMemoryTaskStore();
    globalThis.__tamgaMemoryTaskStore = taskStore;
    return taskStore;
  }

  return createRuntimeTaskStore({
    mockMode: runtimeEnv.MOCK_MODE,
    databaseUrl: runtimeEnv.DATABASE_URL
  });
}
