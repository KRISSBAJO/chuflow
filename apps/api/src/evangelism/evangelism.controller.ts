import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { APP_ROLES } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CaptureOutreachDto,
  CreateOutreachContactDto,
  CreateOutreachLinkDto,
  OutreachListQueryDto,
  LinkOutreachGuestDto,
  ToggleOutreachLinkDto,
  UpdateOutreachDto,
} from './evangelism.dto';
import { EvangelismService } from './evangelism.service';

@Injectable()
export class OutreachCaptureGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; expires: number }
  >();
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ ip: string }>();
    const now = Date.now();
    for (const [key, value] of this.attempts)
      if (value.expires <= now) this.attempts.delete(key);
    const key = req.ip;
    const value = this.attempts.get(key) ?? { count: 0, expires: now + 60_000 };
    if (
      value.count >= 60 ||
      (!this.attempts.has(key) && this.attempts.size >= 10_000)
    )
      throw new HttpException('Please wait a minute before trying again.', 429);
    value.count++;
    this.attempts.set(key, value);
    return true;
  }
}

@Controller('evangelism')
export class EvangelismController {
  constructor(private readonly service: EvangelismService) {}

  @Roles(...APP_ROLES)
  @Get('branches')
  branches(@CurrentUser() user: AuthUser) {
    return this.service.branchOptions(user);
  }

  @Public()
  @Get('public/:token')
  publicInfo(@Param('token') token: string) {
    return this.service.publicInfo(token);
  }

  @Public()
  @UseGuards(OutreachCaptureGuard)
  @Post('public/:token')
  capturePublic(
    @Param('token') token: string,
    @Body() dto: CaptureOutreachDto,
  ) {
    return this.service.capturePublic(token, dto);
  }

  @Roles(...APP_ROLES)
  @Get('links')
  links(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) {
    return this.service.listLinks(user, branchId);
  }

  @Roles(...APP_ROLES)
  @Post('links')
  createLink(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOutreachLinkDto,
  ) {
    return this.service.createLink(user, dto);
  }

  @Roles(...APP_ROLES)
  @Patch('links/:id')
  toggleLink(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ToggleOutreachLinkDto,
  ) {
    return this.service.toggleLink(user, id, dto.isActive);
  }

  @Roles(...APP_ROLES)
  @Get('contacts')
  list(@CurrentUser() user: AuthUser, @Query() params: OutreachListQueryDto) {
    return this.service.list(user, params);
  }

  @Roles(...APP_ROLES)
  @Get('team/:branchId')
  team(@CurrentUser() user: AuthUser, @Param('branchId') branchId: string) {
    return this.service.team(user, branchId);
  }

  @Roles(...APP_ROLES)
  @Post('contacts')
  capture(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOutreachContactDto,
  ) {
    return this.service.captureStaff(user, dto);
  }

  @Roles(...APP_ROLES)
  @Get('contacts/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.detail(user, id);
  }

  @Roles(...APP_ROLES)
  @Get('contacts/:id/guest-matches')
  guestMatches(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.guestMatches(user, id);
  }

  @Roles(...APP_ROLES)
  @Post('contacts/:id/link-guest')
  linkGuest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LinkOutreachGuestDto,
  ) {
    return this.service.linkGuest(user, id, dto.guestId);
  }

  @Roles(...APP_ROLES)
  @Patch('contacts/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOutreachDto,
  ) {
    return this.service.update(user, id, dto);
  }
}
