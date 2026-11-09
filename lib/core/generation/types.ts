import type { SupportedLocale } from '@/lib/i18n';
import type { ProductAnalysis } from '@/lib/core/analysis/types';

export type ImageKind = 'selling' | 'white' | 'scene' | 'closeup' | 'closeup_white';

export type Resolution = '1k' | '2k' | '4k';

export type AspectRatio =
  | '1:1'
  | '3:4'
  | '4:3'
  | '2:3'
  | '3:2'
  | '9:16'
  | '16:9'
  | '4:5'
  | '5:4'
  | '21:9'
  | '9:21';

export type OutputLanguage = SupportedLocale;

export type FontStyle = 'auto' | 'geometric_sans' | 'bold_sans' | 'elegant_serif';

export type GenerationModel = 'nano-banana-2' | 'nano-banana-pro' | 'gpt-image-pro';
export type GenerationMode = 'product' | 'model';

export type TargetPlatform =
  | 'general'
  | 'kaspi'
  | 'aman'
  | 'wildberries'
  | 'ozon'
  | 'tmall'
  | 'jd'
  | 'amazon'
  | 'tiktok'
  | 'shopee';

export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export type ImageItemStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface ImageTypeCount {
  kind: ImageKind;
  count: number;
}

export interface GenerationSettingsInput {
  mode?: GenerationMode;
  platform?: TargetPlatform;
  category?: string;
  productInfo: string;
  analysis?: ProductAnalysis;
  model: GenerationModel;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  outputLanguage: OutputLanguage;
  fontStyle: FontStyle;
  imageTypes: ImageTypeCount[];
}

export interface GenerationSettings extends Omit<GenerationSettingsInput, 'mode' | 'platform'> {
  mode: GenerationMode;
  platform: TargetPlatform;
  promptProductInfo?: string;
  totalImages: number;
}

export interface GenerationItem {
  id: string;
  kind: ImageKind;
  index: number;
  status: ImageItemStatus;
  providerRequestId?: string;
  resultUrl?: string;
  error?: string;
}

export interface GenerationTask {
  id: string;
  deviceId: string;
  // 任务归属用户(登录后生成必填);旧的匿名设备任务可能无此字段
  userId?: string;
  sourceImageUrl: string;
  sourceImageUrls?: string[];
  settings: GenerationSettings;
  status: TaskStatus;
  items: GenerationItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGenerationTaskInput {
  deviceId: string;
  userId?: string;
  sourceImageUrl: string;
  sourceImageUrls?: string[];
  settings: GenerationSettingsInput;
}

export interface GenerationProvider {
  startItem(input: {
    task: GenerationTask;
    item: GenerationItem;
  }): Promise<
    | { status: 'running'; requestId: string }
    | { status: 'succeeded'; resultUrl: string }
    | { status: 'failed'; error: string }
  >;
  syncItem(input: {
    task: GenerationTask;
    item: GenerationItem;
  }): Promise<
    | { status: 'running'; requestId: string }
    | { status: 'succeeded'; resultUrl: string }
    | { status: 'failed'; error: string }
  >;
  generateItem(input: {
    task: GenerationTask;
    item: GenerationItem;
  }): Promise<{ resultUrl: string }>;
}
