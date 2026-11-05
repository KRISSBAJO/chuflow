import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  APP_ROLES,
  LEADERSHIP_ROLES,
} from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { MeetingsService } from './meetings.service';
import {
  MeetingListDto,
  MeetingAudienceDto,
  MeetingRevisionDto,
  MeetingParticipantsDto,
  CreateMeetingDto,
  GroupDto,
  UpdateMeetingDto,
} from './meetings.dto';
@Controller('meetings')
@Roles(...APP_ROLES)
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}
  @Get('participants')
  participants(@CurrentUser() u: AuthUser, @Query() q: MeetingParticipantsDto) {
    return this.service.participants(u, q.branchId, q.q, q.page, q.kind);
  }
  @Post('audience-preview') previewAudience(
    @CurrentUser() u: AuthUser,
    @Body() dto: MeetingAudienceDto,
  ) {
    return this.service.previewAudience(u, dto);
  }
  @Post(':id/invitations/retry') retryInvitations(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.retryInvitations(u, id);
  }
  @Get('options') options(
    @CurrentUser() u: AuthUser,
    @Query('mode') mode?: string,
  ) {
    return this.service.options(u, mode !== 'form');
  }
  @Get('groups') groups(@CurrentUser() u: AuthUser) {
    return this.service.groups(u);
  }
  @Post('groups') @Roles(...LEADERSHIP_ROLES) createGroup(
    @CurrentUser() u: AuthUser,
    @Body() b: GroupDto,
  ) {
    return this.service.saveGroup(u, b);
  }
  @Patch('groups/:id') @Roles(...LEADERSHIP_ROLES) updateGroup(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() b: GroupDto,
  ) {
    return this.service.saveGroup(u, b, id);
  }
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: MeetingListDto) {
    return this.service.list(u, q);
  }
  @Post() create(@CurrentUser() u: AuthUser, @Body() b: CreateMeetingDto) {
    return this.service.create(u, b);
  }
  @Get(':id') details(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.details(u, id);
  }
  @Patch(':id') update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() b: UpdateMeetingDto,
  ) {
    return this.service.update(u, id, b);
  }
  @Post(':id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  upload(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
  ) {
    return this.service.upload(u, id, file);
  }
  @Delete(':id/files/:fileId') remove(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Body() b: MeetingRevisionDto,
  ) {
    return this.service.removeFile(u, id, fileId, b.expectedRevision);
  }
  @Get(':id/files/:fileId') async download(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const file = await this.service.download(u, id, fileId);
    res.setHeader('Content-Type', file.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.data);
  }
}
