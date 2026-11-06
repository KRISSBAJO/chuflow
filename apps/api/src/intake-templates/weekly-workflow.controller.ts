import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  ForwardWeeklyDto,
  ReviewPacketDto,
  ReviewWeeklyDto,
  SaveWeeklyDto,
} from './weekly-workflow.dto';
import { WeeklyWorkflowService } from './weekly-workflow.service';

@Controller('weekly-reports')
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
export class WeeklyWorkflowController {
  constructor(private readonly service: WeeklyWorkflowService) {}
  @Get() list(
    @CurrentUser() u: AuthUser,
    @Query('weekEnding') week: string,
    @Query('district') district?: string,
    @Query('oversightRegion') region?: string,
  ) {
    return this.service.list(
      u,
      week || new Date().toISOString(),
      district,
      region,
    );
  }
  @Get('defaults') defaults(
    @CurrentUser() u: AuthUser,
    @Query('branchId') branch: string,
    @Query('weekEnding') week: string,
  ) {
    return this.service.defaults(u, branch, week || new Date().toISOString());
  }
  @Get('recipients') recipients(
    @CurrentUser() u: AuthUser,
    @Query('district') district: string,
    @Query('oversightRegion') region: string,
  ) {
    return this.service.recipients(u, district, region);
  }
  @Get('packets') packets(@CurrentUser() u: AuthUser) {
    return this.service.packetList(u);
  }
  @Post('packets') forward(
    @CurrentUser() u: AuthUser,
    @Body() dto: ForwardWeeklyDto,
  ) {
    return this.service.forward(u, dto);
  }
  @Patch('packets/:id') reviewPacket(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewPacketDto,
  ) {
    return this.service.reviewPacket(u, id, dto);
  }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: SaveWeeklyDto) {
    return this.service.save(u, dto);
  }
  @Patch(':id') save(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: SaveWeeklyDto,
  ) {
    return this.service.save(u, dto, id);
  }
  @Patch(':id/review') review(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewWeeklyDto,
  ) {
    return this.service.review(u, id, dto);
  }
}
