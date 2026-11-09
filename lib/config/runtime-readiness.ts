export type RuntimeMode = 'mock' | 'real';

export interface RuntimeReadinessInput {
  MOCK_MODE: boolean;
  FAL_KEY?: string;
  ALI_DASHSCOPE_KEY?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  DATABASE_URL?: string;
  REDIS_URL?: string;
}

export interface RuntimeReadiness {
  ok: boolean;
  mode: RuntimeMode;
  imageProvider: 'mock' | 'fal.ai';
  translationProvider: 'mock' | 'qwen-mt';
  storageProvider: 'memory' | 'r2';
  taskStore: 'memory' | 'postgres';
  missing: string[];
}

type RequiredCredentialKey = Exclude<keyof RuntimeReadinessInput, 'MOCK_MODE'>;

const REAL_MODE_REQUIRED_KEYS: RequiredCredentialKey[] = [
  'FAL_KEY',
  'ALI_DASHSCOPE_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'DATABASE_URL'
];

export function resolveRuntimeReadiness(input: RuntimeReadinessInput): RuntimeReadiness {
  if (input.MOCK_MODE) {
    return {
      ok: true,
      mode: 'mock',
      imageProvider: 'mock',
      translationProvider: 'mock',
      storageProvider: 'memory',
      taskStore: 'memory',
      missing: []
    };
  }

  const missing = REAL_MODE_REQUIRED_KEYS.filter((key) => !input[key]?.trim());

  return {
    ok: missing.length === 0,
    mode: 'real',
    imageProvider: 'fal.ai',
    translationProvider: 'qwen-mt',
    storageProvider: 'r2',
    taskStore: 'postgres',
    missing
  };
}
