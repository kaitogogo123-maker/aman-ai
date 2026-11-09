export const KAZAKHSTAN_PHONE_PREFIX = '+7';

export function normalizeKazakhstanLocalPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const local = digits.length > 10 && (digits.startsWith('7') || digits.startsWith('8')) ? digits.slice(1) : digits;

  return local.slice(0, 10);
}

export function formatKazakhstanAuthPhone(localPhone: string): string {
  const local = normalizeKazakhstanLocalPhoneInput(localPhone);
  return local ? `${KAZAKHSTAN_PHONE_PREFIX}${local}` : '';
}
