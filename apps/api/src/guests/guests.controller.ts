import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateGuestDto, UpdateGuestDto } from './dto/create-guest.dto';
import { MergeGuestsDto } from './dto/merge-guests.dto';
import { GuestsService } from './guests.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

@ApiTags('Guests')
@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Public()
  @Post('public-register')
  createPublic(@Body() dto: CreateGuestDto) {
    return this.guestsService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
@Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGuestDto) {
    return this.guestsService.create(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.guestsService.findAll(
      user,
      branchId,
      search,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up')
  @Get('duplicates')
  duplicates(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) {
    return this.guestsService.findDuplicates(user, branchId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.guestsService.findOne(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateGuestDto) {
    return this.guestsService.update(id, dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor')
  @Post(':id/merge')
  merge(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MergeGuestsDto) {
    return this.guestsService.mergeGuests(id, dto.sourceGuestId, user);
  }
}
