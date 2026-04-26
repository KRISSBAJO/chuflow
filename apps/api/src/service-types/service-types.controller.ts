import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateServiceTypeDto, UpdateServiceTypeDto } from './dto/create-service-type.dto';
import { ServiceTypesService } from './service-types.service';

@ApiTags('Service Types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'usher')
@Controller('service-types')
export class ServiceTypesController {
  constructor(private readonly serviceTypesService: ServiceTypesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateServiceTypeDto,
  ): Promise<Record<string, unknown>> {
    return this.serviceTypesService.create(dto, user);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.serviceTypesService.findAll(user, branchId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    return this.serviceTypesService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceTypeDto,
  ): Promise<Record<string, unknown>> {
    return this.serviceTypesService.update(id, dto, user);
  }
}
