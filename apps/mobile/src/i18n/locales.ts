import { getLocales } from 'expo-localization';

/* The same four languages as the website (apps/web/src/i18n/config.ts). */

export const LOCALES = ['en', 'fr', 'es', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Each language named in itself, as the website's picker shows them. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
};

/** BCP 47 tags used for Intl formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  pt: 'pt-BR',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** The first device language we support, or English. */
export function deviceLocale(): Locale {
  for (const entry of getLocales()) {
    const code = (entry.languageCode ?? entry.languageTag.split('-')[0]).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}
