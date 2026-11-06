/*
 * Small pure helpers shared by the ChuFlow Kids record pages (forms, family page,
 * registration review). No "use client" so server pages can import them too.
 */
export const RELATIONSHIP_KEYS = [
  "parent",
  "mother",
  "father",
  "grandparent",
  "guardian",
  "emergency",
  "other",
] as const;
export type RelationshipKey = (typeof RELATIONSHIP_KEYS)[number];

export const ROOM_TEMPLATES = [
  { key: "nursery", minMonths: 0, maxMonths: 23, capacity: 12 },
  { key: "toddlers", minMonths: 24, maxMonths: 47, capacity: 15 },
  { key: "preschool", minMonths: 36, maxMonths: 71, capacity: 20 },
  { key: "kids", minMonths: 72, maxMonths: 119, capacity: 25 },
  { key: "preteens", minMonths: 120, maxMonths: 155, capacity: 25 },
  { key: "teens", minMonths: 156, maxMonths: 215, capacity: 30 },
] as const;
export type RoomTemplateKey = (typeof ROOM_TEMPLATES)[number]["key"];

export const MAX_MONTHS = 216;

/** Completed months between a birth date (YYYY-MM-DD) and `now`; null when unknown or in the future. */
export function ageInMonths(birthDate: string, now = new Date()): number | null {
  if (!birthDate) return null;
  const b = parseDateOnly(birthDate);
  if (!b) return null;
  let months =
    (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  return months < 0 ? null : months;
}

/** Parses an API date-only string (YYYY-MM-DD) as local midnight; null when invalid. */
export function parseDateOnly(value: string): Date | null {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function splitMonths(total: number) {
  return { years: Math.floor(total / 12), months: total % 12 };
}

/** First letter of up to two words, upper-cased, for `kids-avatar` markers. */
export function initials(name: string) {
  return (
    name
      .replace(/^(the|la|le|les|los|las|os|as|a|o|famille|familia|família|family)\s+/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** Two-digit local date/time pieces for `<input type="date">` / `type="time">`. */
export function localDateValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function localTimeValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
