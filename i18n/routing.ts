import { defineRouting } from 'next-intl/routing';
import { workspacePathnames } from '@/lib/workspace/manifest';

export const routing = defineRouting({
  locales: ['tr', 'en'],
  defaultLocale: 'tr',
  localePrefix: 'always',
  pathnames: workspacePathnames,
});

export type Locale = (typeof routing.locales)[number];

export const locales = routing.locales;
export const defaultLocale = routing.defaultLocale;
