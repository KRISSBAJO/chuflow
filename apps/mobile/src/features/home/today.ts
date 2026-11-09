const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export type HomeServiceSchedule = {
  name: string;
  dayOfWeek: string;
  startTime: string;
  timezone: string;
  isActive: boolean;
  attendanceEntryEnabled: boolean;
  locationNotes?: string;
  serviceTypeId?: string | { _id: string } | null;
};

export function nextLocalService(schedules: HomeServiceSchedule[], now: Date) {
  return schedules.flatMap((schedule) => {
    const weekday = WEEKDAYS.indexOf(schedule.dayOfWeek);
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(schedule.startTime);
    if (!schedule.isActive || weekday < 0 || !match) return [];

    let parts: Intl.DateTimeFormatPart[];
    try {
      parts = new Intl.DateTimeFormat('en-US', {
        timeZone: schedule.timezone, year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
      }).formatToParts(now);
    } catch {
      return [];
    }
    const value = (key: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === key)?.value);
    const localDay = new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
    const daysAway = (weekday - localDay.getUTCDay() + 7) % 7;
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    const elapsed = minutes < value('hour') * 60 + value('minute');
    // Keep the church's wall time intact when the phone is in another timezone.
    const start = new Date(localDay.getTime() + daysAway * 86_400_000 + minutes * 60_000);
    return [{ schedule, start, isToday: daysAway === 0, rank: daysAway * 2880 + (daysAway === 0 && elapsed ? 2880 - minutes : minutes) }];
  }).sort((left, right) => left.rank - right.rank)[0];
}
