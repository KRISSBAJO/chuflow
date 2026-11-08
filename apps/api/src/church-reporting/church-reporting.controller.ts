import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JsonSubmissionGuard } from '../common/guards/json-submission.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateAttendanceDto } from '../attendance/dto/create-attendance.dto';
import { CreateOfferingEntryDto } from '../finance/dto/create-offering-entry.dto';
import { CreateExpenseEntryDto } from '../finance/dto/create-expense-entry.dto';
import { ChurchReportingService } from './church-reporting.service';
import { RequiresFeature } from '../platform/requires-feature.decorator';

@ApiTags('Local church reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, JsonSubmissionGuard)
@RequiresFeature('reporting')
@Controller('church-reporting')
export class ChurchReportingController {
  constructor(private readonly reporting: ChurchReportingService) {}

  @Get(':branchId')
  @Roles('branch_admin', 'resident_pastor', 'associate_pastor', 'usher')
  context(@CurrentUser() user: AuthUser, @Param('branchId') branchId: string) {
    return this.reporting.context(user, branchId);
  }

  @Post(':branchId/attendance')
  @Roles('branch_admin', 'resident_pastor', 'associate_pastor', 'usher')
  attendance(
    @CurrentUser() user: AuthUser,
    @Param('branchId') branchId: string,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.reporting.recordAttendance(user, branchId, dto);
  }

  @Post(':branchId/offerings')
  @Roles('resident_pastor', 'associate_pastor', 'usher')
  offering(
    @CurrentUser() user: AuthUser,
    @Param('branchId') branchId: string,
    @Body() dto: CreateOfferingEntryDto,
  ) {
    return this.reporting.recordOffering(user, branchId, dto);
  }

  @Post(':branchId/expenses')
  @Roles('branch_admin', 'resident_pastor', 'associate_pastor')
  expense(
    @CurrentUser() user: AuthUser,
    @Param('branchId') branchId: string,
    @Body() dto: CreateExpenseEntryDto,
  ) {
    return this.reporting.recordExpense(user, branchId, dto);
  }
}
