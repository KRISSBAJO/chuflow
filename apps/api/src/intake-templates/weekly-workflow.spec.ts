import { BadRequestException } from '@nestjs/common';
import { reportWeek, validateWeeklyFigures, WEEKLY_FIGURES } from './weekly-workflow.service';

describe('weekly workflow validation',()=>{
 it('uses one Monday-to-Sunday period even when a station submits on a weekday',()=>{
  expect(reportWeek('2026-11-06').date.toISOString()).toBe('2026-11-08T00:00:00.000Z');
  expect(reportWeek('2026-11-08').from.toISOString()).toBe('2026-11-02T00:00:00.000Z');
 });
 it('rejects negative, fractional and injected comparison figures',()=>{
  for(const figures of [{currentAttendance:-1},{currentAttendance:1.5},{previousAttendance:123}])expect(()=>validateWeeklyFigures(figures)).toThrow(BadRequestException);
 });
 it('allows a partial draft but requires explicit numbers for submission',()=>{
  expect(()=>validateWeeklyFigures({currentAttendance:0})).not.toThrow();
  expect(()=>validateWeeklyFigures({currentAttendance:0},true)).toThrow(BadRequestException);
  expect(()=>validateWeeklyFigures(Object.fromEntries(WEEKLY_FIGURES.map(key=>[key,0])),true)).not.toThrow();
 });
});
