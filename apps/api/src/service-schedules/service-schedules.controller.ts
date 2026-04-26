import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateServiceScheduleDto, UpdateServiceScheduleDto } from './dto/create-service-schedule.dto';
import { ServiceSchedulesService } from './service-schedules.service';

@ApiTags('Service schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('service-schedules')
export class ServiceSchedulesController {
  constructor(private readonly serviceSchedulesService: ServiceSchedulesService) {}

  @Get()
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
  list(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.serviceSchedulesService.findAll(user, branchId);
  }

  @Post()
  @Roles(
    'super_admin',
    'national_admin',
    'district_admin',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
  )
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateServiceScheduleDto,
  ): Promise<Record<string, unknown>> {
    return this.serviceSchedulesService.create(dto, user);
  }

  @Patch(':id')
  @Roles(
    'super_admin',
    'national_admin',
    'district_admin',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
  )
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceScheduleDto,
  ): Promise<Record<string, unknown>> {
    return this.serviceSchedulesService.update(id, dto, user);
  }

  @Get('instances')
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
  listInstances(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('serviceScheduleId') serviceScheduleId?: string,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.serviceSchedulesService.listInstances(user, {
      branchId,
      serviceScheduleId,
      date,
      dateFrom,
      dateTo,
      status,
    });
  }
}
