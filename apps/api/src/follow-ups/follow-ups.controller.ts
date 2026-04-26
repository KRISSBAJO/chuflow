import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FollowUpsService } from './follow-ups.service';
import { CreateFollowUpDto, UpdateFollowUpDto } from './dto/create-follow-up.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

@ApiTags('Follow Ups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up')
@Controller('follow-ups')
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFollowUpDto) {
    return this.followUpsService.create(dto, user);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('assignedTo') assignedTo?: string,
    @Query('status') status?: string,
    @Query('guestId') guestId?: string,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.followUpsService.findAll(user, {
      assignedTo,
      status,
      guestId,
      branchId,
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 12,
    });
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.followUpsService.findOne(id, user);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateFollowUpDto) {
    return this.followUpsService.update(id, dto, user);
  }
}
