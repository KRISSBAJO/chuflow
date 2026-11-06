import type { ChildSession, Phase } from './types';

/*
 * Pure helpers shared by the Kids screens, translated from the website's
 * components/children/home/age.ts and records-utils.ts.
 */

export const MAX_MONTHS = 216;

export const ROOM_TEMPLATES = [
  { key: 'nursery', minMonths: 0, maxMonths: 23, capacity: 12 },
  { key: 'toddlers', minMonths: 24, maxMonths: 47, capacity: 15 },
  { key: 'preschool', minMonths: 36, maxMonths: 71, capacity: 20 },
  { key: 'kids', minMonths: 72, maxMonths: 119, capacity: 25 },
  { key: 'preteens', minMonths: 120, maxMonths: 155, capacity: 25 },
  { key: 'teens', minMonths: 156, maxMonths: 215, capacity: 30 },
] as const;
export type RoomTemplateKey = (typeof ROOM_TEMPLATES)[number]['key'];

/** Human age range for a classroom given completed-month bounds, e.g. "0–3 y", "6–18 mo", "18 mo–3 y". */
export function formatAgeRange(minMonths: number, maxMonths: number, months: (count: number) => string, years: (count: number) => string) {
  const upper = Math.ceil((maxMonths + 1) / 12);
  if (maxMonths + 1 < 24) return `${minMonths}–${months(maxMonths + 1)}`;
  if (minMonths < 24 && minMonths !== 0) return `${months(minMonths)}–${years(upper)}`;
  return `${Math.floor(minMonths / 12)}–${years(upper)}`;
}

/** Parses an API date-only string (YYYY-MM-DD) as local midnight; null when invalid. */
export function parseDateOnly(value: string): Date | null {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Completed months between a birth date and `now`; null when unknown or in the future. */
export function ageInMonths(birthDate: string, now = new Date()): number | null {
  if (!birthDate) return null;
  const b = parseDateOnly(birthDate);
  if (!b) return null;
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  return months < 0 ? null : months;
}

export function splitMonths(total: number) {
  return { years: Math.floor(total / 12), months: total % 12 };
}

/** First letter of up to two words, like the website's kids avatars ("The Garcia family" → "G"). */
export function familyInitials(name: string) {
  return (
    name
      .replace(/^(the|la|le|les|los|las|os|as|a|o|famille|familia|família|family)\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?'
  );
}

export function localDateValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function localTimeValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "HH:MM" → minutes since midnight, or null when not a valid time. */
export function parseTime(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2})[:.hH](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Same rules as the website desk: upcoming / live / ending (last 15 min) / overdue / closed. */
export function phaseOf(s: Pick<ChildSession, 'status' | 'startsAt' | 'endsAt'>, present: number, now: number): Phase {
  if (s.status !== 'open') return 'closed';
  const starts = Date.parse(s.startsAt);
  const ends = Date.parse(s.endsAt);
  if (now < starts) return 'upcoming';
  if (now > ends) return present > 0 ? 'overdue' : 'ending';
  if (ends - now <= 15 * 60000) return 'ending';
  return 'live';
}
