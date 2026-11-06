import { useMemo } from 'react';
import { toLocalDate } from '@/lib/format';
import { LOCALE_TAGS, type Locale } from './locales';
import { makeTranslator, useLocale } from './provider';

/*
 * Language-aware formatting. Screens use `useAppFormat()`; code outside React can call
 * `makeFormat(locale)`. Dates respect the phone's own timezone (service dates are calendar days).
 */

const DAY = 86_400_000;

export function makeFormat(locale: Locale) {
  const tag = LOCALE_TAGS[locale];
  const t = makeTranslator(locale, 'common');

  const safe = <T,>(run: () => T, fallback: T) => {
    try {
      return run();
    } catch {
      return fallback;
    }
  };

  const number = (value?: number | null, options?: Intl.NumberFormatOptions) =>
    safe(() => new Intl.NumberFormat(tag, options).format(value ?? 0), String(value ?? 0));

  const money = (amount: number, currency = 'USD', options?: Intl.NumberFormatOptions) =>
    safe(
      () => new Intl.NumberFormat(tag, { style: 'currency', currency, maximumFractionDigits: 0, ...options }).format(amount),
      `${currency} ${number(amount)}`,
    );

  const date = (value?: string | Date | null, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => {
    if (!value) return '';
    const parsed = toLocalDate(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return safe(() => new Intl.DateTimeFormat(tag, options).format(parsed), parsed.toDateString());
  };

  const time = (value?: string | Date | null) => date(value, { hour: 'numeric', minute: '2-digit' });
  const dateTime = (value?: string | Date | null) => date(value, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const longDate = (value?: string | Date | null) => date(value, { weekday: 'long', day: 'numeric', month: 'long' });
  const weekday = (value?: string | Date | null) => date(value, { weekday: 'short' });

  /** "Today", "Yesterday", "Mon", or "12 Mar", in the current language. */
  const shortDate = (value?: string | Date | null) => {
    if (!value) return '';
    const parsed = toLocalDate(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const diff = start.getTime() - new Date(parsed).setHours(0, 0, 0, 0);
    if (diff === 0) return t('time.today');
    if (diff === DAY) return t('time.yesterday');
    if (diff === -DAY) return t('time.tomorrow');
    if (diff > 0 && diff < 6 * DAY) return weekday(parsed);
    return date(parsed, { day: 'numeric', month: 'short' });
  };

  /** "Just now", "5m ago", "in 2h", then a short date. */
  const relativeTime = (value?: string | Date | null) => {
    if (!value) return '';
    const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
    if (Number.isNaN(minutes)) return '';
    const abs = Math.abs(minutes);
    if (abs < 1) return t('time.justNow');
    if (minutes > 0) {
      if (abs < 60) return t('time.minutesAgo', { count: abs });
      if (abs < 60 * 24) return t('time.hoursAgo', { count: Math.round(abs / 60) });
      if (abs < 60 * 24 * 7) return t('time.daysAgo', { count: Math.round(abs / (60 * 24)) });
      return shortDate(value);
    }
    if (abs < 60) return t('time.inMinutes', { count: abs });
    if (abs < 60 * 24) return t('time.inHours', { count: Math.round(abs / 60) });
    if (abs < 60 * 24 * 7) return t('time.inDays', { count: Math.round(abs / (60 * 24)) });
    return shortDate(value);
  };

  const greeting = (now = new Date()) => {
    const hour = now.getHours();
    if (hour < 12) return t('time.goodMorning');
    if (hour < 17) return t('time.goodAfternoon');
    return t('time.goodEvening');
  };

  const fullName = (person?: { firstName?: string; lastName?: string } | null) =>
    [person?.firstName, person?.lastName].filter(Boolean).join(' ') || t('state.unnamed');

  /** Status labels shared with the website; unknown values are humanised. */
  const status = (value?: string | null) => {
    if (!value) return '';
    if (t.has(`statuses.${value}`)) return t(`statuses.${value}`);
    const text = value.replace(/_/g, ' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const role = (value?: string | null) => (value && t.has(`roles.${value}`) ? t(`roles.${value}`) : value?.replace(/_/g, ' ') || '');

  return { locale, tag, number, money, date, time, dateTime, longDate, weekday, shortDate, relativeTime, greeting, fullName, status, role };
}

export type AppFormat = ReturnType<typeof makeFormat>;

export function useAppFormat(): AppFormat {
  const locale = useLocale();
  return useMemo(() => makeFormat(locale), [locale]);
}
