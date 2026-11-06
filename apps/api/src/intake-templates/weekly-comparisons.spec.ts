import { weeklyComparisons } from './weekly-comparisons';

describe('weekly report comparisons', () => {
  const report = (date: string, count: number, updatedAt?: string) => ({
    serviceDate: new Date(date),
    currentAttendance: count,
    updatedAt: updatedAt ? new Date(updatedAt) : undefined,
  });
  it('compares the previous week and calendar periods, retaining real zero attendance', () => {
    expect(
      weeklyComparisons(
        [
          report('2025-01-05', 100),
          report('2025-12-28', 200),
          report('2026-10-04', 0),
          report('2026-10-11', 100),
          report('2026-10-25', 80),
          report('2026-11-01', 900),
        ],
        new Date('2026-11-06'),
      ),
    ).toEqual({
      previousAttendance: 900,
      averageLastPeriod: 60,
      averageLastYear: 150,
    });
  });
  it('uses the latest revision once per week and does not invent missing observations', () => {
    expect(
      weeklyComparisons(
        [
          report('2026-10-25', 50, '2026-10-26'),
          report('2026-10-25', 90, '2026-10-27'),
          report('2026-11-01', 90),
          report('2026-12-01', 500),
        ],
        new Date('2026-11-06'),
      ),
    ).toEqual({
      previousAttendance: 90,
      averageLastPeriod: 90,
      averageLastYear: undefined,
    });
    expect(
      weeklyComparisons([], new Date('2026-01-01')).previousAttendance,
    ).toBeUndefined();
  });
});
