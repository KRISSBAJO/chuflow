import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreateBranchOverrideDto,
  CreateDistrictOverrideDto,
  CreateIntakeTemplateDto,
  UpdateIntakeTemplateDto,
} from './dto/manage-intake-template.dto';
import { PublicTemplateSubmitDto } from './dto/public-submit.dto';
import { IntakeTemplatesService } from './intake-templates.service';

@ApiTags('Intake Templates')
@Controller('intake-templates')
export class IntakeTemplatesController {
  constructor(
    private readonly intakeTemplatesService: IntakeTemplatesService,
    private readonly configService: ConfigService,
  ) {}

  private getWebUrl() {
    return this.configService.get<string>('webUrl');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
@Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.intakeTemplatesService.findAll(user, this.getWebUrl());
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateIntakeTemplateDto) {
    return this.intakeTemplatesService.create(dto, user, this.getWebUrl());
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateIntakeTemplateDto) {
    return this.intakeTemplatesService.update(id, dto, user, this.getWebUrl());
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
  @Post(':id/branch-override')
  createBranchOverride(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateBranchOverrideDto,
  ) {
    return this.intakeTemplatesService.createBranchOverride(id, dto, user, this.getWebUrl());
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
  @Post(':id/district-override')
  createDistrictOverride(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateDistrictOverrideDto,
  ) {
    return this.intakeTemplatesService.createDistrictOverride(id, dto, user, this.getWebUrl());
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
  @Get('weekly-reports')
  listWeeklyReports(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('oversightRegion') oversightRegion?: string,
    @Query('district') district?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.intakeTemplatesService.listWeeklyReports(user, {
      branchId,
      oversightRegion,
      district,
      status,
      dateFrom,
      dateTo,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
  @Get('weekly-reports/export.csv')
  async exportWeeklyReportsCsv(
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
    @Query('branchId') branchId?: string,
    @Query('oversightRegion') oversightRegion?: string,
    @Query('district') district?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const csv = await this.intakeTemplatesService.exportWeeklyReportsCsv(user, {
      branchId,
      oversightRegion,
      district,
      status,
      dateFrom,
      dateTo,
    });
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="weekly-spiritual-indices.csv"');
    response.send(csv);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
  @Get('maag-reports')
  listMaagReports(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('oversightRegion') oversightRegion?: string,
    @Query('district') district?: string,
    @Query('status') status?: string,
    @Query('monthFrom') monthFrom?: string,
    @Query('monthTo') monthTo?: string,
  ) {
    return this.intakeTemplatesService.listMaagReports(user, {
      branchId,
      oversightRegion,
      district,
      status,
      monthFrom,
      monthTo,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
  @Get('maag-reports/export.csv')
  async exportMaagReportsCsv(
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
    @Query('branchId') branchId?: string,
    @Query('oversightRegion') oversightRegion?: string,
    @Query('district') district?: string,
    @Query('status') status?: string,
    @Query('monthFrom') monthFrom?: string,
    @Query('monthTo') monthTo?: string,
  ) {
    const csv = await this.intakeTemplatesService.exportMaagReportsCsv(user, {
      branchId,
      oversightRegion,
      district,
      status,
      monthFrom,
      monthTo,
    });
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="maag-monthly-report.csv"');
    response.send(csv);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.intakeTemplatesService.findOne(id, user, this.getWebUrl());
  }

  @Public()
  @Get('public/active')
  getActive(@Query('kind') kind: string) {
    return this.intakeTemplatesService.getActivePublicTemplate(kind, this.getWebUrl());
  }

  @Public()
  @Get('public/templates')
  listActive(@Query('kind') kind: string): Promise<Record<string, unknown>[]> {
    return this.intakeTemplatesService.listActivePublicTemplates(kind, this.getWebUrl());
  }

  @Public()
  @Get('public/branch-options')
  listPublicBranchOptions(
    @Query('oversightRegion') oversightRegion?: string,
    @Query('district') district?: string,
  ) {
    return this.intakeTemplatesService.listPublicBranchOptions({
      oversightRegion,
      district,
    });
  }

  @Public()
  @Get('public/:slug')
  getPublicTemplate(@Param('slug') slug: string, @Query('branchId') branchId?: string) {
    return this.intakeTemplatesService.getPublicTemplateBySlug(
      slug,
      this.getWebUrl(),
      branchId,
    );
  }

  @Public()
  @Post('public/:slug/submit')
  submitPublic(
    @Param('slug') slug: string,
    @Body() dto: PublicTemplateSubmitDto,
    @Query('branchId') branchId?: string,
  ) {
    return this.intakeTemplatesService.submitPublic(slug, dto, this.getWebUrl(), branchId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'follow_up',
    'usher',
  )
  @Get('attendance-submissions')
  listAttendanceSubmissions(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.intakeTemplatesService.listAttendanceSubmissions(user, { branchId, status });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'follow_up',
  )
  @Patch('attendance-submissions/:id/approve')
  approveAttendanceSubmission(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.intakeTemplatesService.approveAttendanceSubmission(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'follow_up',
  )
  @Patch('attendance-submissions/:id/reject')
  rejectAttendanceSubmission(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.intakeTemplatesService.rejectAttendanceSubmission(id, user);
  }
}
