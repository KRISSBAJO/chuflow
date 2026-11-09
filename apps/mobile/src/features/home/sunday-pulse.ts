import type { ReportsSummary } from '@/features/reports/types';

export function sundayPulse(trends: ReportsSummary['trends']) {
  const sundays = trends.filter((point) => point.hasAttendanceRecord === true &&
    /^\d{4}-\d{2}-\d{2}$/.test(point.date) && new Date(`${point.date}T00:00:00Z`).getUTCDay() === 0);
  const current = sundays.reduce<(typeof sundays)[number] | undefined>(
    (latest, point) => !latest || point.date > latest.date ? point : latest, undefined,
  );
  if (!current) return undefined;
  const previousDay = new Date(`${current.date}T00:00:00Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 7);
  const previous = sundays.find((point) => point.date === previousDay.toISOString().slice(0, 10));
  return { current, change: previous ? current.attendance - previous.attendance : undefined };
}
