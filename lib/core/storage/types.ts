export interface UploadProductImageInput {
  fileName: string;
  contentType: string;
  body: Uint8Array;
  deviceId: string;
}

export interface UploadedObject {
  key: string;
  url: string;
  provider: 'mock' | 'r2';
}

export interface StorageProvider {
  uploadProductImage(input: UploadProductImageInput): Promise<UploadedObject>;
}
