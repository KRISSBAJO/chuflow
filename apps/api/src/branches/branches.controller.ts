import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/create-branch.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import type { BranchOverviewSummary, BranchStructureSummary } from './branches.service';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Roles('super_admin', 'district_admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto, user);
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
  @Get('overview')
  findOverview(@CurrentUser() user: AuthUser): Promise<BranchOverviewSummary[]> {
    return this.branchesService.findOverview(user);
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
  @Get('structure')
  findStructure(@CurrentUser() user: AuthUser): Promise<BranchStructureSummary> {
    return this.branchesService.findStructure(user);
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
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.branchesService.findAll(user);
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
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.branchesService.findOne(id, user);
  }

  @Roles('super_admin', 'district_admin')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto, user);
  }
}
