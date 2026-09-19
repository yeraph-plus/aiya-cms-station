import { toBcp47, type Locale } from '@/lib/i18n/locale';

/** Pure formatting: safe to import from SSR components or hydrated islands. */
export function displayDate(value: string, locale: Locale = 'zh_CN'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(toBcp47(locale), {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
