import { describe, expect, it, vi } from 'vitest';
import { MockStorageProvider } from '@/lib/core/storage/mock-storage-provider';
import { R2StorageProvider } from '@/lib/core/storage/r2-storage-provider';
import { createStorageProvider } from '@/lib/core/storage/provider-factory';

describe('createStorageProvider', () => {
  it('uses mock storage in mock mode', () => {
    const storage = createStorageProvider({
      mockMode: true,
      r2: {
        accountId: 'account',
        accessKeyId: 'access',
        secretAccessKey: 'secret',
        bucketUploads: 'tamga-uploads'
      },
      clientFactory: vi.fn()
    });

    expect(storage).toBeInstanceOf(MockStorageProvider);
  });

  it('uses mock storage when R2 credentials are missing', () => {
    const storage = createStorageProvider({
      mockMode: false,
      r2: {
        accountId: '',
        accessKeyId: '',
        secretAccessKey: '',
        bucketUploads: 'tamga-uploads'
      },
      clientFactory: vi.fn()
    });

    expect(storage).toBeInstanceOf(MockStorageProvider);
  });

  it('uses R2 storage when real mode has credentials', () => {
    const storage = createStorageProvider({
      mockMode: false,
      r2: {
        accountId: 'account',
        accessKeyId: 'access',
        secretAccessKey: 'secret',
        bucketUploads: 'tamga-uploads'
      },
      clientFactory: vi.fn(() => ({ send: vi.fn() }))
    });

    expect(storage).toBeInstanceOf(R2StorageProvider);
  });
});
