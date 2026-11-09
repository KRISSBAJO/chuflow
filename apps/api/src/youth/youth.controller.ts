import { Body, Controller, Delete, Get, Header, Headers, Ip, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { APP_ROLES } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { YouthAttendanceDto, YouthBranchDto, YouthEventDto, YouthGroupDto, YouthGroupSettingsDto, YouthLeaderDto, YouthRegistrationDto, YouthReviewDto, YouthTransitionDto } from './youth.dto';
import { YouthService } from './youth.service';
import { YouthMentoringCheckInDto, YouthMentoringDto, YouthProgressDto, YouthProjectDto, YouthTrackDto } from './youth-development.dto';
import { YouthDevelopmentService } from './youth-development.service';

@Controller('youth')
@Roles(...APP_ROLES)
export class YouthController {
  constructor(private readonly youth: YouthService, private readonly development: YouthDevelopmentService) {}

  @Get('groups/:id/development') @Header('Cache-Control', 'no-store')
  developmentOverview(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.development.overview(user, id); }

  @Post('groups/:id/development/tracks')
  track(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthTrackDto) { return this.development.createTrack(user, id, dto); }

  @Post('groups/:id/development/projects')
  project(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthProjectDto) { return this.development.createProject(user, id, dto); }

  @Post('groups/:id/development/mentoring')
  mentoring(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthMentoringDto) { return this.development.createMentoring(user, id, dto); }

  @Patch('groups/:id/development/:activity/progress')
  progress(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('activity') activity: string, @Body() dto: YouthProgressDto) {
    return this.development.mark(user, id, activity, dto);
  }

  @Post('groups/:id/development/:activity/check-ins')
  mentoringCheckIn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('activity') activity: string, @Body() dto: YouthMentoringCheckInDto) {
    return this.development.checkIn(user, id, activity, dto);
  }

  @Patch('groups/:id/development/:activity/end')
  endMentoring(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('activity') activity: string) {
    return this.development.endMentoring(user, id, activity);
  }

  @Get() @Header('Cache-Control', 'no-store')
  overview(@CurrentUser() user: AuthUser) { return this.youth.overview(user); }

  @Post('pilot')
  seed(@CurrentUser() user: AuthUser, @Body() dto: YouthBranchDto) { return this.youth.seedPilot(user, dto.branchId); }

  @Post('groups')
  create(@CurrentUser() user: AuthUser, @Body() dto: YouthGroupDto) { return this.youth.createGroup(user, dto); }

  @Post('events')
  event(@CurrentUser() user: AuthUser, @Body() dto: YouthEventDto) { return this.youth.createEvent(user, dto); }

  @Get('groups/:id') @Header('Cache-Control', 'no-store')
  details(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('date') date?: string, @Query('view') view?: string) {
    return this.youth.details(user, id, date, view === 'attendance');
  }

  @Patch('groups/:id/leader')
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthLeaderDto) { return this.youth.assign(user, id, dto); }

  @Patch('groups/:id/settings')
  settings(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthGroupSettingsDto) {
    return this.youth.groupSettings(user, id, dto);
  }

  @Post('groups/:id/link')
  open(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.youth.registrationLink(user, id, true); }

  @Delete('groups/:id/link')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.youth.registrationLink(user, id, false); }

  @Get('groups/:id/people/:person/matches') @Header('Cache-Control', 'no-store')
  matches(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('person') person: string) {
    return this.youth.matches(user, id, person);
  }

  @Patch('groups/:id/people/:person')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('person') person: string, @Body() dto: YouthReviewDto) {
    return this.youth.review(user, id, person, dto);
  }

  @Post('groups/:id/people/:person/welcome')
  welcome(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('person') person: string) {
    return this.youth.welcome(user, id, person);
  }

  @Post('groups/:id/people/:person/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('person') person: string) {
    return this.youth.withdraw(user, id, person);
  }

  @Post('groups/:id/people/:person/transition')
  transition(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('person') person: string, @Body() dto: YouthTransitionDto) {
    return this.youth.transition(user, id, person, dto);
  }

  @Patch('groups/:id/attendance')
  attendance(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthAttendanceDto) {
    return this.youth.attendance(user, id, dto);
  }
}

@Controller('youth-registration')
export class YouthRegistrationController {
  constructor(private readonly youth: YouthService) {}

  @Public() @Get() @Header('Cache-Control', 'no-store')
  info(@Headers('x-youth-registration') token: string) { return this.youth.publicInfo(token); }

  @Public() @Post() @Header('Cache-Control', 'no-store')
  register(@Headers('x-youth-registration') token: string, @Body() dto: YouthRegistrationDto, @Ip() ip: string) {
    return this.youth.register(token, dto, ip);
  }
}
