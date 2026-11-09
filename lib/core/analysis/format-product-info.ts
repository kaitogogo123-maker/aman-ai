import type { ProductAnalysis } from './types';
import type { GenerationMode } from '@/lib/core/generation/types';
import type { SupportedLocale } from '@/lib/i18n';

const LABELS: Record<GenerationMode, Record<SupportedLocale, string[]>> = {
  product: {
    zh: ['产品名称', '目标受众', '卖点描述', '材质描述', '使用方式', '产品类目'],
    en: ['Product name', 'Target audience', 'Selling points', 'Material description', 'Usage method', 'Product category'],
    ru: ['Название товара', 'Целевая аудитория', 'Преимущества', 'Материалы', 'Способ использования', 'Категория товара'],
    kk: ['Тауар атауы', 'Мақсатты аудитория', 'Артықшылықтары', 'Материал сипаттамасы', 'Қолдану тәсілі', 'Тауар санаты']
  },
  model: {
    zh: ['基础档案', '工艺细节', '功能性', '穿搭方案', '核心营销卖点', '服装类目'],
    en: ['Base profile', 'Construction details', 'Functionality', 'Styling plan', 'Core marketing points', 'Apparel category'],
    ru: ['Профиль одежды', 'Конструкция и детали', 'Функциональность', 'Стилизация', 'Ключевые маркетинговые тезисы', 'Категория одежды'],
    kk: ['Киім профилі', 'Құрылым бөлшектері', 'Функционал', 'Образ ұсыныстары', 'Негізгі маркетингтік ойлар', 'Киім санаты']
  }
};

export function formatProductAnalysisForTextarea(
  analysis: ProductAnalysis,
  mode: GenerationMode = 'product',
  fallbackLocale: SupportedLocale = 'zh'
) {
  const labels = LABELS[mode][detectAnalysisLocale(analysis, fallbackLocale)];

  return [
    formatLine(labels[0], analysis.productName),
    formatLine(labels[1], analysis.targetAudience),
    formatLine(labels[2], analysis.sellingPoints),
    formatLine(labels[3], analysis.materialDescription),
    formatLine(labels[4], analysis.usageInstructions),
    formatLine(labels[5], analysis.category)
  ].filter(Boolean).join('\n');
}

function formatLine(label: string, value: string) {
  const normalized = value.trim();
  return normalized ? `[${label}]：${normalized}` : '';
}

function detectAnalysisLocale(analysis: ProductAnalysis, fallbackLocale: SupportedLocale): SupportedLocale {
  const text = Object.values(analysis).join('\n');
  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'zh';
  }

  if (/[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(text)) {
    return 'kk';
  }

  if (/[А-Яа-яЁё]/.test(text)) {
    return 'ru';
  }

  return fallbackLocale;
}
