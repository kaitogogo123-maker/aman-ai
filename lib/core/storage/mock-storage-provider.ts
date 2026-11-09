import type { StorageProvider, UploadProductImageInput } from './types';

export class MockStorageProvider implements StorageProvider {
  async uploadProductImage(input: UploadProductImageInput) {
    return {
      key: `mock/${input.deviceId}/source-product.svg`,
      url: '/mock-results/source-product.svg',
      provider: 'mock' as const
    };
  }
}
