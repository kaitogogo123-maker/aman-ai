export const SUPPORT_PHONE_DISPLAY = '+7 700 905 0988';
export const SUPPORT_PHONE_DIGITS = '77009050988';

export function phoneToTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `tel:+${digits}` : 'tel:';
}

export function formatHeaderPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return phone.trim();
}
