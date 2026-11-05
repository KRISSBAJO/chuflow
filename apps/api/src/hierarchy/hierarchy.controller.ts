import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  APP_ROLES,
  LEADERSHIP_ROLES,
} from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { HierarchyService } from './hierarchy.service';
import {
  CreateHierarchyDto,
  UpdateHierarchyDto,
  PlaceChurchDto,
} from './hierarchy.dto';
@Controller('hierarchy')
@Roles(...LEADERSHIP_ROLES)
export class HierarchyController {
  constructor(private readonly service: HierarchyService) {}
  @Get('context') @Roles(...APP_ROLES) context(@CurrentUser() u: AuthUser) {
    return this.service.context(u);
  }
  @Get() list(
    @CurrentUser() u: AuthUser,
    @Query('districtId') districtId?: string,
  ) {
    return this.service.list(u, districtId);
  }
  @Get('pastors/:branchId')
  @Roles('super_admin', 'national_admin', 'district_admin')
  pastors(@CurrentUser() u: AuthUser, @Param('branchId') branchId: string) {
    return this.service.pastors(u, branchId);
  }
  @Post() @Roles('super_admin', 'national_admin', 'district_admin') create(
    @CurrentUser() u: AuthUser,
    @Body() dto: CreateHierarchyDto,
  ) {
    return this.service.create(u, dto);
  }
  @Patch('units/:id')
  @Roles('super_admin', 'national_admin', 'district_admin')
  update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateHierarchyDto,
  ) {
    return this.service.update(u, id, dto);
  }
  @Patch('churches/:id')
  @Roles('super_admin', 'national_admin', 'district_admin')
  place(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: PlaceChurchDto,
  ) {
    return this.service.place(u, id, dto);
  }
}
