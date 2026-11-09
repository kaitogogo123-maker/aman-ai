import { describe, expect, it, vi } from 'vitest';
import { FalGenerationProvider } from '@/lib/core/generation/fal-provider';
import { MockGenerationProvider } from '@/lib/core/generation/mock-provider';
import { createGenerationProvider } from '@/lib/core/generation/provider-factory';

describe('createGenerationProvider', () => {
  it('uses mock provider in mock mode even when fal credentials exist', () => {
    const provider = createGenerationProvider({
      mockMode: true,
      falKey: 'fal_key',
      falClientFactory: vi.fn()
    });

    expect(provider).toBeInstanceOf(MockGenerationProvider);
  });

  it('uses mock provider when real mode lacks a fal key', () => {
    const provider = createGenerationProvider({
      mockMode: false,
      falKey: undefined,
      falClientFactory: vi.fn()
    });

    expect(provider).toBeInstanceOf(MockGenerationProvider);
  });

  it('uses fal provider in real mode when a fal key exists', () => {
    const provider = createGenerationProvider({
      mockMode: false,
      falKey: 'fal_key',
      falClientFactory: vi.fn(() => ({ subscribe: vi.fn() }))
    });

    expect(provider).toBeInstanceOf(FalGenerationProvider);
  });
});
