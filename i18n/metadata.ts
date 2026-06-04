import type { Locale } from './routing';
import { locales } from './routing';

export function getLocalizedAlternates(locale: Locale, pathname = '/') {
  const normalizedPath = pathname === '/' ? '' : pathname;

  return {
    canonical: `/${locale}${normalizedPath}`,
    languages: Object.fromEntries(
      locales.map((item) => [item, `/${item}${normalizedPath}`]),
    ) as Record<Locale, string>,
  };
}
