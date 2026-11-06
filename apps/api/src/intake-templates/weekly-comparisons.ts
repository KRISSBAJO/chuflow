/** UTC week buckets keep report comparisons independent of the server timezone. */
export function weeklyComparisons(
  reports: Array<{
    serviceDate?: Date;
    currentAttendance?: number;
    updatedAt?: Date;
  }>,
  referenceDate = new Date(),
  calendarReference = referenceDate,
) {
  const weekStart = (date: Date) => {
    const day = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    return day.getTime();
  };
  // A resubmission replaces that week's figure; it must not inflate the average.
  const weeks = new Map<
    number,
    { date: Date; count: number; revision: number }
  >();
  for (const report of reports) {
    if (
      !report.serviceDate ||
      !Number.isFinite(report.currentAttendance) ||
      report.currentAttendance! < 0
    )
      continue;
    const date = new Date(report.serviceDate);
    if (!Number.isFinite(date.getTime()) || date >= referenceDate) continue;
    const key = weekStart(date);
    const revision = new Date(report.updatedAt ?? date).getTime();
    if (!weeks.has(key) || revision > weeks.get(key)!.revision) {
      weeks.set(key, { date, count: report.currentAttendance!, revision });
    }
  }
  const year = calendarReference.getUTCFullYear();
  const monthStart = Date.UTC(year, calendarReference.getUTCMonth(), 1);
  const previousMonthStart = Date.UTC(year, calendarReference.getUTCMonth() - 1, 1);
  const mean = (start: number, end: number) => {
    const values = [...weeks.values()].filter(
      ({ date }) => date.getTime() >= start && date.getTime() < end,
    );
    return values.length
      ? Math.round(
          values.reduce((sum, value) => sum + value.count, 0) / values.length,
        )
      : undefined;
  };
  return {
    previousAttendance: weeks.get(weekStart(referenceDate) - 7 * 86400000)
      ?.count,
    averageLastPeriod: mean(previousMonthStart, monthStart),
    averageLastYear: mean(Date.UTC(year - 1, 0, 1), Date.UTC(year, 0, 1)),
  };
}
