import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatMessage, type MessageValues } from './icu';
import { DEFAULT_LOCALE, deviceLocale, isLocale, type Locale } from './locales';
import { MESSAGES } from './messages';

/*
 * Language for the whole app. The choice is kept on the phone (same four languages as the
 * website); until one is chosen the device language decides, falling back to English.
 */

const LOCALE_KEY = 'chuflow.locale';

type I18nState = { locale: Locale; ready: boolean; setLocale: (locale: Locale) => Promise<void> };

const I18nContext = createContext<I18nState>({ locale: DEFAULT_LOCALE, ready: false, setLocale: async () => undefined });

let currentLocale: Locale = DEFAULT_LOCALE;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LOCALE_KEY)
      .then((saved) => {
        const next = isLocale(saved) ? saved : deviceLocale();
        currentLocale = next;
        if (active) setLocaleState(next);
      })
      .catch(() => {
        currentLocale = deviceLocale();
        if (active) setLocaleState(currentLocale);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    currentLocale = next;
    setLocaleState(next);
    await AsyncStorage.setItem(LOCALE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ locale, ready, setLocale }), [locale, ready, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

/** The current language outside React (toasts, queued work). */
export function getLocale() {
  return currentLocale;
}

function lookup(locale: Locale, path: string): unknown {
  let node: unknown = MESSAGES[locale];
  for (const part of path.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function resolve(locale: Locale, path: string) {
  const found = lookup(locale, path);
  if (typeof found === 'string') return found;
  const fallback = locale === DEFAULT_LOCALE ? undefined : lookup(DEFAULT_LOCALE, path);
  if (typeof fallback === 'string') return fallback;
  if (__DEV__) console.warn(`[i18n] missing message "${path}" (${locale})`);
  return path;
}

export type Translator = {
  (key: string, values?: MessageValues): string;
  /** True when the key exists in the current language or English. */
  has: (key: string) => boolean;
  /** The raw object or string at a key, for lists kept in messages. */
  raw: <T = unknown>(key: string) => T | undefined;
  locale: Locale;
};

export function makeTranslator(locale: Locale, namespace?: string): Translator {
  const full = (key: string) => (namespace ? `${namespace}.${key}` : key);
  const t = ((key: string, values?: MessageValues) => formatMessage(locale, resolve(locale, full(key)), values)) as Translator;
  t.has = (key) => typeof lookup(locale, full(key)) === 'string' || typeof lookup(DEFAULT_LOCALE, full(key)) === 'string';
  t.raw = <T,>(key: string) => (lookup(locale, full(key)) ?? lookup(DEFAULT_LOCALE, full(key))) as T | undefined;
  t.locale = locale;
  return t;
}

/**
 * Messages for a namespace, e.g. `const t = useT('members.list'); t('title'); t('count', { count })`.
 * Messages use the website's ICU style: `{name}`, `{count, plural, one {# guest} other {# guests}}`.
 */
export function useT(namespace?: string): Translator {
  const locale = useLocale();
  return useMemo(() => makeTranslator(locale, namespace), [locale, namespace]);
}

/** Translate outside React, in the current language. */
export function translate(key: string, values?: MessageValues) {
  return makeTranslator(currentLocale)(key, values);
}
