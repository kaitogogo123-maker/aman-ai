import { describe, expect, it } from 'vitest';
import { formatHeaderPhone, phoneToTelHref } from '@/lib/core/contact';

describe('contact phone helpers', () => {
  it('formats Kazakhstan user phones for the header and keeps tel href dialable', () => {
    expect(formatHeaderPhone('77009050988')).toBe('+7 (700) 905-09-88');
    expect(phoneToTelHref('+7 700 905 0988')).toBe('tel:+77009050988');
  });
});
