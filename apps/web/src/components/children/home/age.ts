/**
 * Human age range for a classroom given completed-month bounds, e.g. "0–3 y", "6–18 mo", "18 mo–3 y".
 * `months(n)` / `years(n)` are translated unit formatters.
 */
export function formatAgeRange(
  minMonths: number,
  maxMonths: number,
  months: (count: number) => string,
  years: (count: number) => string,
) {
  const upper = Math.ceil((maxMonths + 1) / 12);
  if (maxMonths + 1 < 24) return `${minMonths}–${months(maxMonths + 1)}`;
  if (minMonths < 24 && minMonths !== 0)
    return `${months(minMonths)}–${years(upper)}`;
  return `${Math.floor(minMonths / 12)}–${years(upper)}`;
}
