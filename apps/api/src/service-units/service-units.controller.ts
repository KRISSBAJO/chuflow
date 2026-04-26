import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateServiceUnitDto, UpdateServiceUnitDto } from './dto/create-service-unit.dto';
import { ServiceUnitsService } from './service-units.service';

@ApiTags('Service Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
@Controller('service-units')
export class ServiceUnitsController {
  constructor(private readonly serviceUnitsService: ServiceUnitsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateServiceUnitDto,
  ): Promise<Record<string, unknown>> {
    return this.serviceUnitsService.create(dto, user);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.serviceUnitsService.findAll(user, branchId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    return this.serviceUnitsService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceUnitDto,
  ): Promise<Record<string, unknown>> {
    return this.serviceUnitsService.update(id, dto, user);
  }
}
