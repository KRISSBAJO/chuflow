import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateMemberDto, UpdateMemberDto } from './dto/create-member.dto';
import { MembersService } from './members.service';

@ApiTags('Members')
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
)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMemberDto) {
    return this.membersService.create(dto, user);
  }

  @Post('convert/:guestId')
  convert(@CurrentUser() user: AuthUser, @Param('guestId') guestId: string) {
    return this.membersService.convertGuest(guestId, user);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) {
    return this.membersService.findAll(user, branchId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.membersService.findOne(id, user);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.membersService.update(id, dto, user);
  }
}
