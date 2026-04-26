import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreateOversightRegionDto,
  UpdateOversightRegionDto,
} from './dto/manage-oversight-region.dto';
import {
  OversightRegionSummary,
  OversightRegionsService,
} from './oversight-regions.service';

@ApiTags('Oversight Regions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('oversight-regions')
export class OversightRegionsController {
  constructor(
    private readonly oversightRegionsService: OversightRegionsService,
  ) {}

  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
  )
  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<OversightRegionSummary[]> {
    return this.oversightRegionsService.findAll(user);
  }

  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
  )
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<OversightRegionSummary> {
    return this.oversightRegionsService.findOne(id, user);
  }

  @Roles('super_admin')
  @Post()
  create(
    @Body() dto: CreateOversightRegionDto,
  ): Promise<OversightRegionSummary> {
    return this.oversightRegionsService.create(dto);
  }

  @Roles('super_admin', 'national_admin')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOversightRegionDto,
  ): Promise<OversightRegionSummary> {
    return this.oversightRegionsService.update(id, dto, user);
  }
}
