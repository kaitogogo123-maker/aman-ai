import { describe, expect, it } from 'vitest';
import {
  composeProductInfoWithQuickChips,
  createTamgaModeDrafts,
  updateTamgaModeDraft
} from '@/lib/core/ui/tamga-mode-drafts';

describe('tamga mode drafts', () => {
  it('keeps product and model form state isolated', () => {
    const drafts = createTamgaModeDrafts();

    const nextDrafts = updateTamgaModeDraft(drafts, 'product', {
      productInfo: '商品图说明',
      counts: {
        selling: 2,
        white: 1,
        scene: 0,
        closeup: 0,
        closeup_white: 0
      }
    });

    expect(nextDrafts.product.productInfo).toBe('商品图说明');
    expect(nextDrafts.product.counts.selling).toBe(2);
    expect(nextDrafts.model.productInfo).toBe('');
    expect(nextDrafts.model.counts).toEqual({
      selling: 0,
      white: 1,
      scene: 0,
      closeup: 0,
      closeup_white: 0
    });
    expect(nextDrafts.product).not.toBe(drafts.product);
    expect(nextDrafts.model).toBe(drafts.model);
  });

  it('does not keep a pending AI fill state after analysis', () => {
    const drafts = createTamgaModeDrafts();

    expect('pendingAnalysisFill' in drafts.product).toBe(false);
    expect('pendingAnalysisFill' in drafts.model).toBe(false);
  });

  it('initializes selectedQuickChips with empty groups in both modes', () => {
    const drafts = createTamgaModeDrafts();

    expect(drafts.product.selectedQuickChips).toEqual({ category: [], audience: [], style: [] });
    expect(drafts.model.selectedQuickChips).toEqual({ category: [], audience: [], style: [] });
  });

  it('keeps quick-chip selections isolated between product and model modes', () => {
    const drafts = createTamgaModeDrafts();

    const updated = updateTamgaModeDraft(drafts, 'product', {
      selectedQuickChips: { category: ['Clothing'], audience: ['Women', 'Children'], style: [] }
    });

    expect(updated.product.selectedQuickChips.audience).toEqual(['Women', 'Children']);
    expect(updated.model.selectedQuickChips.audience).toEqual([]);
  });
});

describe('composeProductInfoWithQuickChips', () => {
  const LABELS = { category: 'Категория товара', audience: 'Целевая аудитория', style: 'Стиль фото' };

  it('returns productInfo unchanged when no chips selected', () => {
    const result = composeProductInfoWithQuickChips('исходный текст', { category: [], audience: [], style: [] }, LABELS);
    expect(result).toBe('исходный текст');
  });

  it('prepends a structured prefix when only chips are selected', () => {
    const result = composeProductInfoWithQuickChips(
      '',
      { category: ['Одежда'], audience: ['Женщины', 'Дети'], style: ['Kaspi'] },
      LABELS
    );
    expect(result).toBe(
      'Категория товара: Одежда. Целевая аудитория: Женщины, Дети. Стиль фото: Kaspi.'
    );
  });

  it('prepends prefix above existing productInfo body, separated by blank line', () => {
    const result = composeProductInfoWithQuickChips(
      'Лёгкие кроссовки для повседневной носки.',
      { category: ['Одежда'], audience: [], style: [] },
      LABELS
    );
    expect(result).toBe(
      'Категория товара: Одежда.\n\nЛёгкие кроссовки для повседневной носки.'
    );
  });

  it('omits groups whose selection arrays are empty', () => {
    const result = composeProductInfoWithQuickChips(
      '',
      { category: [], audience: ['Дети'], style: [] },
      LABELS
    );
    expect(result).toBe('Целевая аудитория: Дети.');
  });
});

// 守护 hasManualCountEdits flag: marketplace 切换是否覆盖 counts 由它决定
describe('hasManualCountEdits flag', () => {
  it('drafts 初始 hasManualCountEdits=false (允许平台预设套用)', () => {
    const drafts = createTamgaModeDrafts();
    expect(drafts.product.hasManualCountEdits).toBe(false);
    expect(drafts.model.hasManualCountEdits).toBe(false);
  });

  it('updateTamgaModeDraft 可以把 flag 翻成 true 而不影响另一个 mode', () => {
    const drafts = createTamgaModeDrafts();
    const updated = updateTamgaModeDraft(drafts, 'product', {
      hasManualCountEdits: true
    });
    expect(updated.product.hasManualCountEdits).toBe(true);
    expect(updated.model.hasManualCountEdits).toBe(false);
  });
});
