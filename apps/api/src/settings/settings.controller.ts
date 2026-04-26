import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  UpdateAppSettingsDto,
  UpdateBranchSettingsDto,
  UpdateUserPreferencesDto,
} from './dto/update-settings.dto';
import { BranchSettingsResponse, SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher')
  @Get('overview')
  getOverview(@CurrentUser() user: AuthUser) {
    return this.settingsService.getOverview(user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'district_admin', 'branch_admin')
  @Patch('app')
  updateApp(@CurrentUser() user: AuthUser, @Body() dto: UpdateAppSettingsDto) {
    return this.settingsService.updateAppSettings(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher')
  @Patch('preferences')
  updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserPreferencesDto) {
    return this.settingsService.updateUserPreferences(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher')
  @Get('branches/:branchId')
  getBranchSettings(
    @CurrentUser() user: AuthUser,
    @Param('branchId') branchId: string,
  ): Promise<BranchSettingsResponse> {
    return this.settingsService.getBranchSettings(user, branchId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'district_admin', 'branch_admin')
  @Patch('branches/:branchId')
  updateBranchSettings(
    @CurrentUser() user: AuthUser,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchSettingsDto,
  ) {
    return this.settingsService.updateBranchSettings(user, branchId, dto);
  }

  @Public()
  @Get('public')
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }
}
