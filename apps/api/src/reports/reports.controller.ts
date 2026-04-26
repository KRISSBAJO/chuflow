import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ReportsService } from './reports.service';
import type { Response } from 'express';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  dashboard(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('oversightRegion') oversightRegion?: string,
    @Query('district') district?: string,
    @Query('days') days?: string,
  ) {
    return this.reportsService.dashboard(user, {
      branchId,
      oversightRegion,
      district,
      days: Number(days) || 30,
    });
  }

  @Get('summary')
  summary(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('days') days?: string,
  ) {
    return this.reportsService.summary(user, branchId, Number(days) || 30);
  }

  @Get('export.csv')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
    @Query('branchId') branchId?: string,
    @Query('days') days?: string,
  ) {
    const csv = await this.reportsService.exportCsv(user, branchId, Number(days) || 30);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="church-report.csv"');
    response.send(csv);
  }
}
