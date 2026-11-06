import type { BranchRef } from './types';

export function fullName(person?: { firstName?: string; lastName?: string } | null) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Unnamed';
}

export function initials(person?: { firstName?: string; lastName?: string } | null) {
  return `${person?.firstName?.[0] ?? ''}${person?.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export function statusLabel(value?: string | null) {
  if (!value) return '';
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type Tone = 'neutral' | 'flame' | 'success' | 'warning' | 'danger' | 'info';

/** Same whole-word rules as the web app's statusTone. */
export function statusTone(status?: string | null): Tone {
  const words = new Set((status ?? '').toLowerCase().split(/[^a-z]+/).filter(Boolean));
  const hasAny = (...candidates: string[]) => candidates.some((word) => words.has(word));
  if (hasAny('rejected', 'declined', 'failed', 'overdue', 'inactive', 'cancelled', 'error')) return 'danger';
  if (hasAny('pending', 'review', 'draft', 'assigned', 'new', 'waiting', 'submitted')) return 'warning';
  if (hasAny('approved', 'active', 'completed', 'converted', 'returned', 'paid', 'success')) return 'success';
  if (hasAny('contacted', 'prayed', 'invited', 'returning', 'first')) return 'info';
  return 'neutral';
}

export function branchName(ref?: BranchRef | string | null) {
  return ref && typeof ref === 'object' ? (ref.name ?? '') : '';
}

const DAY = 86_400_000;

/**
 * Service dates are stored as a calendar day at UTC midnight; read them back as that same day in
 * the phone's timezone, or a Sunday service shows as Saturday west of Greenwich.
 */
export function toLocalDate(value: string | Date) {
  if (typeof value === 'string') {
    const day = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/);
    if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  }
  return new Date(value);
}

/** "Today", "Yesterday", "Mon", or "12 Mar". */
export function shortDate(value?: string | Date | null) {
  if (!value) return '';
  const date = toLocalDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = start.getTime() - new Date(date).setHours(0, 0, 0, 0);
  if (diff === 0) return 'Today';
  if (diff === DAY) return 'Yesterday';
  if (diff > 0 && diff < 6 * DAY) return date.toLocaleDateString(undefined, { weekday: 'short' });
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function relativeTime(value?: string | null) {
  if (!value) return '';
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return shortDate(value);
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatNumber(value?: number | null) {
  return new Intl.NumberFormat().format(value ?? 0);
}

export function formatMoney(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${formatNumber(amount)}`;
  }
}

/** yyyy-mm-dd in the phone's own timezone (not UTC), for service dates. */
export function isoDay(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Digits only, keeping a leading + for international numbers. */
export function dialable(phone?: string) {
  if (!phone) return '';
  const trimmed = phone.trim();
  return (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '');
}
