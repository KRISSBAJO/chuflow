import { Body, Controller, Delete, Get, Header, Headers, Ip, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { MAX_YOUTH_PDF_BYTES } from './youth-pdf-scan';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { APP_ROLES } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { YouthAttendanceDto, YouthBranchDto, YouthCampDto, YouthCampFinanceDto, YouthCampFollowUpDto, YouthCampLinkDto, YouthCampLogisticsDto, YouthEventDto, YouthGroupDto, YouthGroupSettingsDto, YouthLeaderDto, YouthRegistrationDto, YouthReviewDto, YouthTransitionDto } from './youth.dto';
import { YouthService } from './youth.service';
import { YouthChatMessageDto, YouthChatReviewDto, YouthChatSettingDto, YouthMentoringCheckInDto, YouthMentoringConsentDto, YouthMentoringDto, YouthMentoringReminderDto, YouthPollVoteDto, YouthPostDto, YouthProgramResponseDto, YouthProgressDto, YouthProjectDto, YouthRolloutDto, YouthServiceMinutesDto, YouthTrackDto } from './youth-development.dto';
import { YouthDevelopmentService } from './youth-development.service';
import { YouthParticipantInviteDto } from './youth.dto';

@Controller('youth')
@Roles(...APP_ROLES)
export class YouthController {
  constructor(private readonly youth: YouthService, private readonly development: YouthDevelopmentService) {}

  @Get('groups/:id/development') @Header('Cache-Control', 'no-store')
  developmentOverview(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.development.overview(user, id); }

  @Patch('groups/:id/development/rollout')
  rollout(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthRolloutDto) {
    return this.youth.saveRollout(user, id, dto);
  }

  @Post('groups/:id/development/mentoring-consent/:person') @Header('Cache-Control', 'no-store')
  mentoringConsentInvite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('person') person: string) {
    return this.youth.inviteMentoringConsent(user, id, person);
  }

  @Post('groups/:id/development/:activity/mentoring-email')
  mentoringEmail(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('activity') activity: string) {
    return this.youth.sendMentoringEmail(user, id, activity);
  }

  @Get('groups/:id/development/chat') @Header('Cache-Control', 'no-store')
  staffChat(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.youth.staffChat(user, id);
  }

  @Patch('groups/:id/development/chat/settings')
  chatSettings(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthChatSettingDto) {
    return this.youth.chatSetting(user, id, dto.enabled);
  }

  @Patch('groups/:id/development/chat/consent/:person')
  chatConsent(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('person') person: string, @Body() dto: YouthChatSettingDto) {
    return this.youth.chatConsent(user, id, person, dto.enabled);
  }

  @Post('groups/:id/development/chat/messages')
  staffChatPost(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthChatMessageDto) {
    return this.youth.postChat(user, dto.body, id);
  }

  @Patch('groups/:id/development/chat/messages/:message')
  reviewChat(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('message') message: string, @Body() dto: YouthChatReviewDto) {
    return this.youth.reviewChat(user, id, message, dto.action);
  }

  @Post('groups/:id/development/posts')
  publishPost(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthPostDto) {
    return this.youth.publishPost(user, id, dto);
  }

  @Delete('groups/:id/development/posts/:post')
  archivePost(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('post') post: string) {
    return this.youth.archivePost(user, id, post);
  }

  @Get('groups/:id/development/posts/:post/responses') @Header('Cache-Control', 'no-store')
  programResponses(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('post') post: string) {
    return this.youth.readProgramResponses(user, id, post);
  }

  @Get('groups/:id/development/posts/:post/poll-results') @Header('Cache-Control', 'no-store')
  pollResults(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('post') post: string) {
    return this.youth.pollResults(user, id, post);
  }

  @Patch('groups/:id/development/posts/:post/close-poll')
  closePoll(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('post') post: string) {
    return this.youth.closePoll(user, id, post);
  }

  @Post('groups/:id/development/posts/:post/pdf')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_YOUTH_PDF_BYTES, files: 1, fields: 0, parts: 2 } }))
  uploadProgramPdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('post') post: string,
    @UploadedFile() file?: { originalname: string; buffer: Buffer }) {
    return this.youth.uploadProgramPdf(user, id, post, file);
  }

  @Delete('groups/:id/development/posts/:post/pdf')
  removeProgramPdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('post') post: string) {
    return this.youth.removeProgramPdf(user, id, post);
  }

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

  @Patch('groups/:id/development/:activity/service-minutes')
  verifyService(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('activity') activity: string, @Body() dto: YouthServiceMinutesDto) {
    return this.development.verifyService(user, id, activity, dto);
  }

  @Post('groups/:id/development/:activity/check-ins')
  mentoringCheckIn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('activity') activity: string, @Body() dto: YouthMentoringCheckInDto) {
    return this.development.checkIn(user, id, activity, dto);
  }

  @Patch('groups/:id/development/:activity/reminder')
  mentoringReminder(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('activity') activity: string, @Body() dto: YouthMentoringReminderDto) {
    return this.development.mentoringReminder(user, id, activity, dto);
  }

  @Patch('groups/:id/development/:activity/end')
  endMentoring(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('activity') activity: string) {
    return this.development.endMentoring(user, id, activity);
  }

  @Get() @Header('Cache-Control', 'no-store')
  overview(@CurrentUser() user: AuthUser) { return this.youth.overview(user); }

  @Get('reports') @Header('Cache-Control', 'no-store')
  reports(@CurrentUser() user: AuthUser) { return this.youth.reports(user); }

  @Get('home-preview') @Header('Cache-Control', 'no-store')
  homePreview(@CurrentUser() user: AuthUser) { return this.youth.homePreview(user); }

  @Post('groups/:id/people/:person/invite') @Header('Cache-Control', 'no-store')
  inviteParticipant(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('person') person: string, @Body() dto: YouthParticipantInviteDto) {
    return this.youth.inviteParticipant(user, id, person, dto);
  }

  @Post('pilot')
  seed(@CurrentUser() user: AuthUser, @Body() dto: YouthBranchDto) { return this.youth.seedPilot(user, dto.branchId); }

  @Post('groups')
  create(@CurrentUser() user: AuthUser, @Body() dto: YouthGroupDto) { return this.youth.createGroup(user, dto); }

  @Post('events')
  event(@CurrentUser() user: AuthUser, @Body() dto: YouthEventDto) { return this.youth.createEvent(user, dto); }

  @Post('camps')
  createCamp(@CurrentUser() user: AuthUser, @Body() dto: YouthCampDto) { return this.youth.createCamp(user, dto); }

  @Get('camps/:id') @Header('Cache-Control', 'no-store')
  campOverview(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('branch') branch?: string, @Query('date') date?: string) {
    return this.youth.campOverview(user, id, branch, date);
  }

  @Post('camps/:id/branches')
  addCampBranch(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthBranchDto) {
    return this.youth.addCampBranch(user, id, dto.branchId);
  }

  @Patch('camps/:id/branches/:branch/link')
  campLink(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('branch') branch: string, @Body() dto: YouthCampLinkDto) {
    return this.youth.campLink(user, id, branch, dto.enabled);
  }

  @Patch('camps/:id/branches/:branch/attendance')
  campAttendance(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('branch') branch: string, @Body() dto: YouthAttendanceDto) {
    return this.youth.campAttendance(user, id, branch, dto);
  }

  @Patch('camps/:id/branches/:branch/people/:person/review')
  campReview(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('branch') branch: string, @Param('person') person: string, @Body() dto: YouthReviewDto) {
    return this.youth.campReview(user, id, branch, person, dto);
  }

  @Patch('camps/:id/branches/:branch/people/:person/withdraw')
  campWithdraw(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('branch') branch: string, @Param('person') person: string) {
    return this.youth.campWithdraw(user, id, branch, person);
  }

  @Patch('camps/:id/branches/:branch/people/:person/logistics')
  campLogistics(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('branch') branch: string, @Param('person') person: string, @Body() dto: YouthCampLogisticsDto) {
    return this.youth.campLogistics(user, id, branch, person, dto);
  }

  @Post('camps/:id/branches/:branch/people/:person/ledger')
  campFinance(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('branch') branch: string, @Param('person') person: string, @Body() dto: YouthCampFinanceDto) {
    return this.youth.campFinance(user, id, branch, person, dto);
  }

  @Patch('camps/:id/branches/:branch/people/:person/follow-up')
  campFollowUp(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('branch') branch: string, @Param('person') person: string, @Body() dto: YouthCampFollowUpDto) {
    return this.youth.campFollowUp(user, id, branch, person, dto);
  }

  @Post('camps/:id/branches/:branch/people/:person/guardian-reminder')
  campGuardianReminder(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('branch') branch: string, @Param('person') person: string) {
    return this.youth.eventGuardianReminder(user, id, person, branch);
  }

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

  @Patch('groups/:id/people/:person/follow-up')
  eventFollowUp(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('person') person: string, @Body() dto: YouthCampFollowUpDto) {
    return this.youth.eventFollowUp(user, id, person, dto);
  }

  @Post('groups/:id/people/:person/guardian-reminder')
  eventGuardianReminder(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('person') person: string) {
    return this.youth.eventGuardianReminder(user, id, person);
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

@Controller('youth-participant')
@Roles('youth_participant')
export class YouthParticipantController {
  constructor(private readonly youth: YouthService) {}

  @Get('home') @Header('Cache-Control', 'no-store')
  home(@CurrentUser() user: AuthUser) { return this.youth.participantHome(user); }

  @Get('chat') @Header('Cache-Control', 'no-store')
  chat(@CurrentUser() user: AuthUser) {
    return this.youth.participantChat(user);
  }

  @Post('chat/messages')
  chatPost(@CurrentUser() user: AuthUser, @Body() dto: YouthChatMessageDto) {
    return this.youth.postChat(user, dto.body);
  }

  @Post('chat/messages/:message/report')
  reportChat(@CurrentUser() user: AuthUser, @Param('message') message: string) {
    return this.youth.reportChat(user, message);
  }

  @Post('programs/:id/response')
  programResponse(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthProgramResponseDto) {
    return this.youth.submitProgramResponse(user, id, dto.answer);
  }

  @Post('polls/:id/vote')
  vote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: YouthPollVoteDto) {
    return this.youth.voteInPoll(user, id, dto.option);
  }

  @Post('programs/:id/pdf-ticket') @Header('Cache-Control', 'no-store')
  programPdfTicket(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.youth.programPdfTicket(user, id);
  }

  @Post('projects/:id/signup')
  signup(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.youth.participantServe(user, id); }
}

@Controller('youth-registration')
export class YouthRegistrationController {
  constructor(private readonly youth: YouthService) {}

  @Public() @Get('program-pdf/:ticket')
  async downloadProgramPdf(@Param('ticket') ticket: string, @Res() res: Response) {
    const file = await this.youth.downloadProgramPdf(ticket);
    res.set({
      'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${file.name}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    });
    res.send(file.buffer);
  }

  @Public() @Post('mentoring-consent') @Header('Cache-Control', 'no-store')
  mentoringConsent(@Headers('x-youth-registration') token: string, @Body() dto: YouthMentoringConsentDto, @Ip() ip: string) {
    return this.youth.setMentoringConsent(token, dto, ip);
  }

  @Public() @Post('unsubscribe') @Header('Cache-Control', 'no-store')
  unsubscribe(@Headers('x-youth-registration') token: string, @Ip() ip: string) {
    return this.youth.unsubscribeGuardian(token, ip);
  }

  @Public() @Get() @Header('Cache-Control', 'no-store')
  info(@Headers('x-youth-registration') token: string) { return this.youth.publicInfo(token); }

  @Public() @Post() @Header('Cache-Control', 'no-store')
  register(@Headers('x-youth-registration') token: string, @Body() dto: YouthRegistrationDto, @Ip() ip: string) {
    return this.youth.register(token, dto, ip);
  }
}
