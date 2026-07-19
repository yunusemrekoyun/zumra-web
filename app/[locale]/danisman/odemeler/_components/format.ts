import { APP_TIME_ZONE } from '@/lib/datetime';

export { centsToInput, formatCents, parseTlToCents } from '@/lib/domain/money';

export function formatDay(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

export function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}
