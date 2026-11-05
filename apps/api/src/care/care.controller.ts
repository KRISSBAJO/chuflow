import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { LEADERSHIP_ROLES } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CareChangeDto,
  CareListDto,
  CarePlanDto,
  CarePublicDto,
} from './care.dto';
import { CareService } from './care.service';
@Injectable()
class CarePublicGuard implements CanActivate {
  private attempts = new Map<string, { n: number; until: number }>();
  canActivate(ctx: ExecutionContext) {
    const request = ctx
      .switchToHttp()
      .getRequest<{ ip: string; params?: { token?: string } }>();
    const ip = request.ip + ':' + (request.params?.token || '').slice(0, 16);
    const now = Date.now();
    for (const [key, value] of this.attempts)
      if (value.until < now) this.attempts.delete(key);
    const value = this.attempts.get(ip) || { n: 0, until: now + 60000 };
    if (
      value.n >= 30 ||
      (this.attempts.size >= 10000 && !this.attempts.has(ip))
    )
      throw new HttpException('Please try again shortly.', 429);
    value.n++;
    this.attempts.set(ip, value);
    return true;
  }
}
@Controller('care')
@Roles(...LEADERSHIP_ROLES, 'follow_up')
export class CareController {
  constructor(private readonly service: CareService) {}
  @Public()
  @Roles()
  @UseGuards(CarePublicGuard)
  @Get('public/:token')
  publicInfo(@Param('token') token: string) {
    return this.service.publicInfo(token);
  }
  @Public()
  @Roles()
  @UseGuards(CarePublicGuard)
  @Post('public/:token')
  publicReply(@Param('token') token: string, @Body() dto: CarePublicDto) {
    return this.service.publicReply(token, dto);
  }
  @Get('options') options(@CurrentUser() u: AuthUser) {
    return this.service.options(u);
  }
  @Get('assignees') assignees(
    @CurrentUser() u: AuthUser,
    @Query('branchId') branchId: string,
    @Query('q') q?: string,
    @Query('leadersOnly') leadersOnly?: string,
  ) {
    return this.service.assignees(u, branchId, q, leadersOnly === 'true');
  }
  @Get('overview') overview(
    @CurrentUser() u: AuthUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.service.overview(u, branchId);
  }
  @Roles(...LEADERSHIP_ROLES) @Get('plans/:branchId') plan(
    @CurrentUser() u: AuthUser,
    @Param('branchId') id: string,
  ) {
    return this.service.getPlan(u, id);
  }
  @Roles(...LEADERSHIP_ROLES) @Patch('plans/:branchId') planSave(
    @CurrentUser() u: AuthUser,
    @Param('branchId') id: string,
    @Body() dto: CarePlanDto,
  ) {
    return this.service.savePlan(u, id, dto);
  }
  @Get('cases') list(@CurrentUser() u: AuthUser, @Query() q: CareListDto) {
    return this.service.list(u, q);
  }
  @Get('cases/:id') details(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Query('page') page?: string,
  ) {
    return this.service.details(u, id, page);
  }
  @Patch('cases/:id') change(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: CareChangeDto,
  ) {
    return this.service.change(u, id, dto);
  }
  @Post('cases/:id/check-in-link') link(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.makeLink(u, id);
  }
}
