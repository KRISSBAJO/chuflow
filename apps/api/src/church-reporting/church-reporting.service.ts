import { ForbiddenException, Injectable } from '@nestjs/common';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AttendanceService } from '../attendance/attendance.service';
import { CreateAttendanceDto } from '../attendance/dto/create-attendance.dto';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { FinanceService } from '../finance/finance.service';
import { CreateOfferingEntryDto } from '../finance/dto/create-offering-entry.dto';
import { CreateExpenseEntryDto } from '../finance/dto/create-expense-entry.dto';

@Injectable()
export class ChurchReportingService {
  constructor(
    private readonly scope: AccessScopeService,
    private readonly attendance: AttendanceService,
    private readonly finance: FinanceService,
  ) {}

  async context(user: AuthUser, branchId: string) {
    const branch = await this.scope.localReportingBranch(user, branchId);
    return {
      branch: {
        _id: String(branch._id),
        name: branch.name,
        district: branch.district,
        oversightRegion: branch.oversightRegion,
      },
      canRecordOfferings: [
        'resident_pastor',
        'associate_pastor',
        'usher',
      ].includes(user.role),
      canRecordExpenses: [
        'branch_admin',
        'resident_pastor',
        'associate_pastor',
      ].includes(user.role),
    };
  }

  private async verify(
    user: AuthUser,
    branchId: string,
    submittedBranchId?: string,
  ) {
    await this.scope.localReportingBranch(user, branchId);
    if (submittedBranchId && submittedBranchId !== branchId) {
      throw new ForbiddenException(
        'The submitted church must match this recording link.',
      );
    }
  }

  async recordAttendance(
    user: AuthUser,
    branchId: string,
    dto: CreateAttendanceDto,
  ) {
    await this.verify(user, branchId, dto.branchId);
    return this.attendance.create({ ...dto, branchId }, user);
  }

  async recordOffering(
    user: AuthUser,
    branchId: string,
    dto: CreateOfferingEntryDto,
  ) {
    await this.verify(user, branchId);
    return this.finance.createOfferingEntry(dto, user);
  }

  async recordExpense(
    user: AuthUser,
    branchId: string,
    dto: CreateExpenseEntryDto,
  ) {
    await this.verify(user, branchId, dto.branchId);
    return this.finance.createExpenseEntry({ ...dto, branchId }, user);
  }
}
