import { describe, expect, it } from 'vitest';
import { getMessages, SUPPORTED_LOCALES } from '@/lib/i18n';

describe('admin accounting i18n', () => {
  it('includes admin accounting copy for all supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const m = getMessages(locale).adminAccounting;
      expect(m.heading).toBeTruthy();
      expect(m.timezoneNote).toBeTruthy();
      expect(m.exportUsers).toBeTruthy();
      expect(m.exportLedger).toBeTruthy();
      expect(m.passwordLabel).toBeTruthy();
      expect(m.enter).toBeTruthy();
      expect(m.summaryUsers).toBeTruthy();
      expect(m.summaryFalBalance).toBeTruthy();
      expect(m.usersHeading).toBeTruthy();
      expect(m.ledgerHeading).toBeTruthy();
      expect(m.colPhone).toBeTruthy();
      expect(m.colLastLogin).toBeTruthy();
      expect(m.colCity).toBeTruthy();
      expect(m.colDevice).toBeTruthy();
      expect(m.loginsHeading).toBeTruthy();
      expect(m.exportLogins).toBeTruthy();
      expect(m.colLocation).toBeTruthy();
      expect(m.eventLogin).toBeTruthy();
      expect(m.colPaid).toBeTruthy();
      expect(m.colAmountKzt).toBeTruthy();
    }
  });
});
