import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';

import { Roles } from '../common/decorators/roles.decorator';

import type { AuthUser } from '../common/interfaces/auth-user.interface';

import { PermissionsService } from './permissions.service';

import { GrantPermissionsDto, RevokePermissionDto } from './permission.dto';

@Controller('permissions')
@Roles(
  'super_admin',
  'national_admin',
  'national_pastor',
  'district_admin',
  'district_pastor',
  'branch_admin',
  'resident_pastor',
)
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get('users') targets(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('page') page?: string,
  ) {
    return this.service.targets(user, search, this.page(page));
  }

  @Get('users/:id') detail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.detail(user, id);
  }

  @Get('delegations') list(
    @CurrentUser() user: AuthUser,
    @Query() query: Record<string, string>,
  ) {
    return this.service.list(user, {
      ...query,
      page: this.page(query.page),
      byMe: query.byMe === 'true',
      limit: Number(query.limit),
    });
  }

  @Post('delegations') grant(
    @CurrentUser() user: AuthUser,
    @Body() dto: GrantPermissionsDto,
  ) {
    return this.service.grant(user, dto);
  }

  @Post('delegations/:id/revoke') revoke(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RevokePermissionDto,
  ) {
    return this.service.revoke(user, id, dto);
  }

  @Post('users/:id/revoke-all') revokeAll(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RevokePermissionDto,
  ) {
    return this.service.revokeAll(user, id, dto);
  }
  private page(value?: string) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1;
  }
}
