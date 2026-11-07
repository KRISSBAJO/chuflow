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
 it('limits first timers and new converts independently to current attendance',()=>{
  expect(()=>validateWeeklyFigures({currentAttendance:61,firstTimersCount:36985886})).toThrow('First timers cannot exceed current attendance.');
  expect(()=>validateWeeklyFigures({currentAttendance:61,newConvertsCount:3000})).toThrow('New converts cannot exceed current attendance.');
  expect(()=>validateWeeklyFigures({currentAttendance:61,firstTimersCount:61,newConvertsCount:61})).not.toThrow();
  expect(()=>validateWeeklyFigures({currentAttendance:0,newConvertsCount:1})).toThrow(BadRequestException);
 });
 it('allows decimal WSF averages and independent ministry counts, and rejects unsafe integers',()=>{
  expect(()=>validateWeeklyFigures({currentAttendance:0,wofbiAttendance:20,winnersSatelliteFellowshipAverage:12.5})).not.toThrow();
  expect(()=>validateWeeklyFigures({currentAttendance:Number.MAX_SAFE_INTEGER+1})).toThrow(BadRequestException);
 });
 it('allows a partial draft but requires explicit numbers for submission',()=>{
  expect(()=>validateWeeklyFigures({currentAttendance:0})).not.toThrow();
  expect(()=>validateWeeklyFigures({currentAttendance:0},true)).toThrow(BadRequestException);
  expect(()=>validateWeeklyFigures(Object.fromEntries(WEEKLY_FIGURES.map(key=>[key,0])),true)).not.toThrow();
 });
});
