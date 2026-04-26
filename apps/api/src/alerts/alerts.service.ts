import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import {
  isBranchScopedRole,
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
} from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ExpenseEntry, ExpenseEntryDocument } from '../finance/schemas/expense-entry.schema';
import { FollowUp, FollowUpDocument } from '../follow-ups/schemas/follow-up.schema';
import { Guest, GuestDocument } from '../guests/schemas/guest.schema';
import {
  IntakeSubmission,
  IntakeSubmissionDocument,
} from '../intake-templates/schemas/intake-submission.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  WorkspaceRequest,
  WorkspaceRequestDocument,
} from '../workspace-requests/schemas/workspace-request.schema';

type AlertTone = 'warm' | 'cool' | 'critical';

type AlertItem = {
  key: string;
  label: string;
  count: number;
  tone: AlertTone;
  description: string;
  href: string;
};

@Injectable()
export class AlertsService {
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(FollowUp.name)
    private readonly followUpModel: Model<FollowUpDocument>,
    @InjectModel(Guest.name)
    private readonly guestModel: Model<GuestDocument>,
    @InjectModel(IntakeSubmission.name)
    private readonly intakeSubmissionModel: Model<IntakeSubmissionDocument>,
    @InjectModel(ExpenseEntry.name)
    private readonly expenseEntryModel: Model<ExpenseEntryDocument>,
    @InjectModel(WorkspaceRequest.name)
    private readonly workspaceRequestModel: Model<WorkspaceRequestDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private normalizeDays(days?: number) {
    return Math.min(Math.max(days || 30, 1), 365);
  }

  private startOfDayOffset(days: number) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1));
    return date;
  }

  private async buildScopeQuery(currentUser: AuthUser) {
    if (isGlobalRole(currentUser.role)) {
      return {};
    }

    if (isNationalRole(currentUser.role)) {
      return {
        oversightRegion: currentUser.oversightRegion,
      };
    }

    if (isDistrictRole(currentUser.role)) {
      return {
        oversightRegion: currentUser.oversightRegion,
        district: currentUser.district,
      };
    }

    if (isBranchScopedRole(currentUser.role)) {
      return {
        _id: new Types.ObjectId(currentUser.branchId),
      };
    }

    throw new ForbiddenException('You cannot access alerts from your role');
  }

  async summary(currentUser: AuthUser, days?: number) {
    const safeDays = this.normalizeDays(days);
    const rangeStart = this.startOfDayOffset(safeDays);
    const attendanceRecencyCutoff = this.startOfDayOffset(7);
    const branchScopeQuery = await this.buildScopeQuery(currentUser);
    const branches = await this.branchModel
      .find(branchScopeQuery)
      .select('name oversightRegion district city state status')
      .lean();
    const branchIds = branches
      .map((branch) => String(branch._id))
      .filter((branchId) => Types.ObjectId.isValid(branchId))
      .map((branchId) => new Types.ObjectId(branchId));

    if (branchIds.length === 0 && !isGlobalRole(currentUser.role)) {
      return {
        scope: {
          role: currentUser.role,
          oversightRegion: currentUser.oversightRegion,
          district: currentUser.district,
          branchId: currentUser.branchId,
          branchCount: 0,
        },
        quickStats: {
          firstTimers: 0,
          pendingFollowUp: 0,
          pendingApprovals: 0,
          activeAlerts: 0,
        },
        counts: {
          overdueFollowUp: 0,
          pendingAttendanceApprovals: 0,
          pendingExpenseApprovals: 0,
          pendingWorkspaceRequests: 0,
          branchesWithoutRecentAttendance: 0,
          branchesMissingLeadership: 0,
        },
        items: [] satisfies AlertItem[],
      };
    }

    const branchMatch =
      branchIds.length > 0 ? { $in: branchIds } : undefined;

    const pendingStatuses = ['new', 'assigned', 'contacted', 'prayed_with', 'invited_back'];

    const scopedGuestIds = branchMatch
      ? await this.guestModel.find({ branchId: branchMatch }).distinct('_id')
      : await this.guestModel.find().distinct('_id');

    const [
      firstTimersRows,
      pendingFollowUp,
      overdueFollowUp,
      pendingAttendanceApprovals,
      pendingExpenseApprovals,
      pendingWorkspaceRequests,
      recentAttendanceBranchIds,
      leadershipCounts,
    ] = await Promise.all([
      this.attendanceModel.aggregate<{ _id: null; total: number }>([
        {
          $match: {
            ...(branchMatch ? { branchId: branchMatch } : {}),
            entryMode: 'summary',
            serviceDate: { $gte: rangeStart },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$firstTimersCount', 0] } },
          },
        },
      ]),
      this.followUpModel.countDocuments({
        guestId: { $in: scopedGuestIds },
        status: { $in: pendingStatuses },
      }),
      this.followUpModel.countDocuments({
        guestId: { $in: scopedGuestIds },
        status: { $in: pendingStatuses },
        nextActionDate: { $lt: new Date() },
      }),
      this.intakeSubmissionModel.countDocuments({
        ...(branchMatch ? { branchId: branchMatch } : {}),
        templateKind: 'attendance',
        status: 'pending',
      }),
      this.expenseEntryModel.countDocuments({
        ...(branchMatch ? { branchId: branchMatch } : {}),
        status: 'submitted',
      }),
      isGlobalRole(currentUser.role)
        ? this.workspaceRequestModel.countDocuments({
            status: { $in: ['new', 'in_review'] },
          })
        : Promise.resolve(0),
      this.attendanceModel
        .find({
          ...(branchMatch ? { branchId: branchMatch } : {}),
          serviceDate: { $gte: attendanceRecencyCutoff },
        })
        .distinct('branchId'),
      this.userModel.aggregate<{
        _id: Types.ObjectId;
        residentPastorCount: number;
        associatePastorCount: number;
      }>([
        {
          $match: {
            ...(branchMatch ? { branchId: branchMatch } : {}),
            isActive: true,
            role: { $in: ['resident_pastor', 'associate_pastor'] },
          },
        },
        {
          $group: {
            _id: '$branchId',
            residentPastorCount: {
              $sum: { $cond: [{ $eq: ['$role', 'resident_pastor'] }, 1, 0] },
            },
            associatePastorCount: {
              $sum: { $cond: [{ $eq: ['$role', 'associate_pastor'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const recentAttendanceSet = new Set(recentAttendanceBranchIds.map((branchId) => String(branchId)));
    const leadershipMap = new Map(
      leadershipCounts.map((item) => [
        String(item._id),
        {
          residentPastorCount: item.residentPastorCount,
          associatePastorCount: item.associatePastorCount,
        },
      ]),
    );

    const branchesWithoutRecentAttendance = branches.filter(
      (branch) => !recentAttendanceSet.has(String(branch._id)),
    ).length;
    const branchesMissingLeadership = branches.filter((branch) => {
      const leadership = leadershipMap.get(String(branch._id));
      return (
        !leadership ||
        leadership.residentPastorCount === 0 ||
        leadership.associatePastorCount === 0
      );
    }).length;

    const pendingApprovals =
      pendingAttendanceApprovals + pendingExpenseApprovals + pendingWorkspaceRequests;

    const items: AlertItem[] = [
      pendingAttendanceApprovals > 0
        ? {
            key: 'attendance_approvals',
            label: 'Attendance approvals',
            count: pendingAttendanceApprovals,
            tone: 'warm',
            description: 'Shared attendance submissions are still waiting for review.',
            href: '/approvals',
          }
        : null,
      pendingExpenseApprovals > 0
        ? {
            key: 'expense_approvals',
            label: 'Expense approvals',
            count: pendingExpenseApprovals,
            tone: 'warm',
            description: 'Finance expense requests are waiting for approval.',
            href: '/approvals',
          }
        : null,
      pendingWorkspaceRequests > 0
        ? {
            key: 'workspace_requests',
            label: 'Workspace requests',
            count: pendingWorkspaceRequests,
            tone: 'cool',
            description: 'Public workspace requests need site-admin review.',
            href: '/approvals',
          }
        : null,
      overdueFollowUp > 0
        ? {
            key: 'overdue_follow_up',
            label: 'Overdue follow-up',
            count: overdueFollowUp,
            tone: 'critical',
            description: 'Follow-up tasks are past their next-action date.',
            href: '/follow-up',
          }
        : null,
      branchesMissingLeadership > 0
        ? {
            key: 'missing_leadership',
            label: 'Branch leadership gaps',
            count: branchesMissingLeadership,
            tone: 'critical',
            description: 'Some branches are missing a resident or associate pastor.',
            href: '/branches',
          }
        : null,
      branchesWithoutRecentAttendance > 0
        ? {
            key: 'attendance_watch',
            label: 'No recent attendance',
            count: branchesWithoutRecentAttendance,
            tone: 'warm',
            description: 'Branches in scope have not submitted recent attendance.',
            href: '/dashboard',
          }
        : null,
    ].filter((item): item is AlertItem => !!item);

    items.sort((left, right) => right.count - left.count);

    return {
      scope: {
        role: currentUser.role,
        oversightRegion: currentUser.oversightRegion,
        district: currentUser.district,
        branchId: currentUser.branchId,
        branchCount: branches.length,
      },
      quickStats: {
        firstTimers: firstTimersRows[0]?.total ?? 0,
        pendingFollowUp,
        pendingApprovals,
        activeAlerts: items.length,
      },
      counts: {
        overdueFollowUp,
        pendingAttendanceApprovals,
        pendingExpenseApprovals,
        pendingWorkspaceRequests,
        branchesWithoutRecentAttendance,
        branchesMissingLeadership,
      },
      items,
    };
  }
}
