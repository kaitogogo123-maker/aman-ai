import { fal } from '@fal-ai/client';
import type { FalClient } from './fal-provider';

export function createFalClient(apiKey: string): FalClient {
  fal.config({ credentials: apiKey });

  return {
    async submit(modelId, options) {
      return fal.queue.submit(modelId, options);
    },
    async status(modelId, options) {
      return fal.queue.status(modelId, options);
    },
    async result(modelId, options) {
      return fal.queue.result(modelId, options);
    }
  };
}
