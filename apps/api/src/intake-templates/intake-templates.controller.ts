import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreateBranchOverrideDto,
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
