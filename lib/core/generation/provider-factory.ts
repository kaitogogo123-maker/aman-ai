import { FalGenerationProvider, type FalClient } from './fal-provider';
import { MockGenerationProvider } from './mock-provider';
import type { GenerationProvider } from './types';

export interface GenerationProviderFactoryInput {
  mockMode: boolean;
  falKey?: string;
  falClientFactory: (apiKey: string) => FalClient;
}

export function createGenerationProvider(input: GenerationProviderFactoryInput): GenerationProvider {
  if (input.mockMode || !input.falKey) {
    return new MockGenerationProvider();
  }

  return new FalGenerationProvider({
    client: input.falClientFactory(input.falKey)
  });
}
