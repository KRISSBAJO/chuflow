export const WSF_AVERAGE = 'winnersSatelliteFellowshipAverage';
const ATTENDANCE_LIMITED_FIELDS = ['firstTimersCount', 'newConvertsCount'];

export function weeklyFigureError(key: string, raw: string, attendance: string) {
  if (!raw) return undefined;
  const isAverage = key === WSF_AVERAGE;
  const pattern = isAverage ? /^(?:[0-9]+(?:[.,][0-9]+)?|[.,][0-9]+)$/ : /^[0-9]+$/;
  const value = weeklyFigureNumber(raw);
  if (!pattern.test(raw) || value > Number.MAX_SAFE_INTEGER) {
    return isAverage ? 'invalidAverage' : 'invalidCount';
  }
  if (ATTENDANCE_LIMITED_FIELDS.includes(key) && /^[0-9]+$/.test(attendance) && value > Number(attendance)) {
    return 'aboveAttendance';
  }
  return undefined;
}

export function weeklyFigureNumber(raw: string) {
  return Number(raw.replace(',', '.'));
}

export function weeklyFigureFlags(
  figures: Record<string, unknown>,
  previousAttendance: unknown,
  fields: readonly string[],
) {
  const flags = fields.flatMap((key) => {
    const value = figures[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return [];
    const attendance = figures.currentAttendance;
    if (ATTENDANCE_LIMITED_FIELDS.includes(key) && typeof attendance === 'number' && value > attendance) {
      return [{ key, message: 'aboveAttendance' }];
    }
    return value >= 100_000 ? [{ key, message: 'highFigure' }] : [];
  });
  const attendance = figures.currentAttendance;
  if (
    typeof attendance === 'number' &&
    typeof previousAttendance === 'number' &&
    previousAttendance > 0 &&
    Math.abs(attendance - previousAttendance) >= 50 &&
    (attendance >= previousAttendance * 2 || attendance <= previousAttendance / 2)
  ) {
    flags.push({ key: 'currentAttendance', message: 'attendanceChange' });
  }
  return flags;
}
