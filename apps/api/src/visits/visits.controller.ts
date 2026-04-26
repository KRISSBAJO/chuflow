import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

@ApiTags('Visits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher')
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVisitDto) {
    return this.visitsService.create(dto, user);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string, @Query('guestId') guestId?: string) {
    return this.visitsService.findAll(user, branchId, guestId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.visitsService.findOne(id, user);
  }
}
