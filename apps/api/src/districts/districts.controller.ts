import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateDistrictDto, UpdateDistrictDto } from './dto/manage-district.dto';
import { DistrictSummary, DistrictsService } from './districts.service';

@ApiTags('Districts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('districts')
export class DistrictsController {
  constructor(private readonly districtsService: DistrictsService) {}

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
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('oversightRegion') oversightRegion?: string,
  ): Promise<DistrictSummary[]> {
    return this.districtsService.findAll(user, oversightRegion);
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
  ): Promise<DistrictSummary> {
    return this.districtsService.findOne(id, user);
  }

  @Roles('super_admin', 'national_admin')
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDistrictDto,
  ): Promise<DistrictSummary> {
    return this.districtsService.create(dto, user);
  }

  @Roles('super_admin', 'national_admin', 'district_admin')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDistrictDto,
  ): Promise<DistrictSummary> {
    return this.districtsService.update(id, dto, user);
  }
}
