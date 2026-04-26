import { Injectable } from '@nestjs/common';
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
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { FollowUp, FollowUpDocument } from '../follow-ups/schemas/follow-up.schema';
import { Guest, GuestDocument } from '../guests/schemas/guest.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';

type DashboardScopeKind = 'all_network' | 'national' | 'district' | 'branch';

type ScopedBranch = {
  _id: Types.ObjectId;
  name: string;
  oversightRegion: string;
  district: string;
  city: string;
  state: string;
  status: string;
};

type DashboardScopeFilters = {
  branchId?: string;
  oversightRegion?: string;
  district?: string;
  days?: number;
};

type ResolvedDashboardScope = {
  branches: ScopedBranch[];
  branchObjectIds: Types.ObjectId[];
  branchLookupMatch?: Types.ObjectId | { $in: Types.ObjectId[] };
  scope: {
    kind: DashboardScopeKind;
    label: string;
    role: string;
    oversightRegion?: string;
    district?: string;
    branchId?: string;
    branchName?: string;
    showOperationalDetails: boolean;
  };
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Guest.name) private readonly guestModel: Model<GuestDocument>,
    @InjectModel(FollowUp.name) private readonly followUpModel: Model<FollowUpDocument>,
    @InjectModel(Member.name) private readonly memberModel: Model<MemberDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private normalizeFilterValue(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private normalizeDays(days?: number) {
    if (!Number.isFinite(days) || !days || days < 1) {
      return 30;
    }

    return Math.min(Math.trunc(days), 365);
  }

  private attendanceTotalExpression() {
    return {
      $cond: [
        { $eq: ['$entryMode', 'summary'] },
        {
          $add: [{ $ifNull: ['$adultsCount', 0] }, { $ifNull: ['$childrenCount', 0] }],
        },
        1,
      ],
    };
  }

  private buildScopeLabel(
    kind: DashboardScopeKind,
    values: {
      oversightRegion?: string;
      district?: string;
      branchName?: string;
    },
  ) {
    if (kind === 'branch') {
      return values.branchName || 'Branch dashboard';
    }

    if (kind === 'district') {
      if (values.district && values.oversightRegion) {
        return `${values.district} district · ${values.oversightRegion}`;
      }

      return values.district || 'District dashboard';
    }

    if (kind === 'national') {
      return values.oversightRegion || 'National dashboard';
    }

    return 'All network';
  }

  private buildGuestLookupMatch(branchLookupMatch?: Types.ObjectId | { $in: Types.ObjectId[] }) {
    if (!branchLookupMatch) {
      return [];
    }

    return [{ $match: { 'guest.branchId': branchLookupMatch } }];
  }

  private async countFollowUpsByGuestBranchFilter(
    branchLookupMatch: Types.ObjectId | { $in: Types.ObjectId[] } | undefined,
    statusMatch: Record<string, unknown>,
  ) {
    const pipeline = [
      {
        $lookup: {
          from: 'guests',
          localField: 'guestId',
          foreignField: '_id',
          as: 'guest',
        },
      },
      { $unwind: '$guest' },
      ...this.buildGuestLookupMatch(branchLookupMatch),
      { $match: statusMatch },
      { $count: 'total' },
    ];

    const result = await this.followUpModel.aggregate<{ total: number }>(pipeline);
    return result[0]?.total ?? 0;
  }

  private async resolveDashboardScope(
    currentUser: AuthUser,
    filters: DashboardScopeFilters,
  ): Promise<ResolvedDashboardScope> {
    const requestedBranchId = this.normalizeFilterValue(filters.branchId);
    const requestedOversightRegion = this.normalizeFilterValue(filters.oversightRegion);
    const requestedDistrict = this.normalizeFilterValue(filters.district);

    const baseBranchQuery = await this.accessScopeService.getBranchDocumentQuery(currentUser);
    const scopedBranchQuery: Record<string, unknown> = { ...baseBranchQuery };

    if (requestedBranchId) {
      await this.accessScopeService.ensureBranchAccess(currentUser, requestedBranchId);
      scopedBranchQuery._id = new Types.ObjectId(requestedBranchId);
    } else {
      if (requestedOversightRegion) {
        scopedBranchQuery.oversightRegion = requestedOversightRegion;
      }

      if (requestedDistrict) {
        scopedBranchQuery.district = requestedDistrict;
      }
    }

    const branches = await this.branchModel
      .find(scopedBranchQuery)
      .select('name oversightRegion district city state status')
      .sort({ name: 1 })
      .lean<ScopedBranch[]>();

    const branchObjectIds = branches.map((branch) => new Types.ObjectId(String(branch._id)));
    const branchLookupMatch =
      branchObjectIds.length === 0
        ? undefined
        : branchObjectIds.length === 1
          ? branchObjectIds[0]
          : { $in: branchObjectIds };

    const selectedBranch =
      requestedBranchId || isBranchScopedRole(currentUser.role) ? branches[0] : undefined;

    const effectiveOversightRegion =
      selectedBranch?.oversightRegion ||
      requestedOversightRegion ||
      currentUser.oversightRegion;
    const effectiveDistrict =
      selectedBranch?.district || requestedDistrict || currentUser.district;

    let kind: DashboardScopeKind = 'all_network';

    if (selectedBranch) {
      kind = 'branch';
    } else if (requestedDistrict || isDistrictRole(currentUser.role)) {
      kind = 'district';
    } else if (requestedOversightRegion || isNationalRole(currentUser.role)) {
      kind = 'national';
    } else if (!isGlobalRole(currentUser.role)) {
      kind = 'branch';
    }

    return {
      branches,
      branchObjectIds,
      branchLookupMatch,
      scope: {
        kind,
        label: this.buildScopeLabel(kind, {
          oversightRegion: effectiveOversightRegion,
          district: effectiveDistrict,
          branchName: selectedBranch?.name,
        }),
        role: currentUser.role,
        oversightRegion: effectiveOversightRegion,
        district: effectiveDistrict,
        branchId: selectedBranch ? String(selectedBranch._id) : undefined,
        branchName: selectedBranch?.name,
        showOperationalDetails: kind === 'district' || kind === 'branch',
      },
    };
  }

  async dashboard(currentUser: AuthUser, filters: DashboardScopeFilters = {}) {
    const days = this.normalizeDays(filters.days);
    const scopeResult = await this.resolveDashboardScope(currentUser, filters);
    const { branches, branchObjectIds, branchLookupMatch, scope } = scopeResult;
    const branchMap = new Map(branches.map((branch) => [String(branch._id), branch]));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Math.max(days - 1, 0));
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();

    if (branchObjectIds.length === 0) {
      return {
        scope: {
          ...scope,
          days,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        metrics: {
          totalGuests: 0,
          totalMembers: 0,
          totalAttendance: 0,
          pendingFollowUp: 0,
        },
        executive: {
          branchesWithoutRecentAttendance: [],
          highFollowUpBacklog: [],
          topGrowthBranches: [],
          bottomGrowthBranches: [],
        },
        operational: scope.showOperationalDetails
          ? {
              recentGuests: [],
              newestMembers: [],
              attendanceMix: [],
              followUpPipeline: [],
            }
          : null,
      };
    }

    const branchObjectIdFilter = { branchId: { $in: branchObjectIds } };

    const [
      totalGuests,
      totalMembers,
      attendanceTotalsRaw,
      pendingFollowUp,
      recentAttendanceByBranchRaw,
      followUpBacklogRaw,
      growthGuestsRaw,
      growthMembersRaw,
      growthConvertsRaw,
    ] = await Promise.all([
      this.guestModel.countDocuments(branchObjectIdFilter),
      this.memberModel.countDocuments(branchObjectIdFilter),
      this.attendanceModel.aggregate<{ totalAttendance: number }>([
        {
          $match: {
            ...branchObjectIdFilter,
            serviceDate: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            totalAttendance: { $sum: this.attendanceTotalExpression() },
          },
        },
      ]),
      this.countFollowUpsByGuestBranchFilter(branchLookupMatch, {
        status: { $in: ['new', 'assigned'] },
      }),
      this.attendanceModel.aggregate<{
        _id: Types.ObjectId;
        submissions: number;
        lastSubmittedAt?: Date;
      }>([
        {
          $match: {
            ...branchObjectIdFilter,
            entryMode: 'summary',
            serviceDate: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$branchId',
            submissions: { $sum: 1 },
            lastSubmittedAt: { $max: '$serviceDate' },
          },
        },
      ]),
      this.followUpModel.aggregate<{ _id: Types.ObjectId; pendingFollowUp: number }>([
        {
          $lookup: {
            from: 'guests',
            localField: 'guestId',
            foreignField: '_id',
            as: 'guest',
          },
        },
        { $unwind: '$guest' },
        ...this.buildGuestLookupMatch(branchLookupMatch),
        {
          $match: {
            status: { $in: ['new', 'assigned'] },
          },
        },
        {
          $group: {
            _id: '$guest.branchId',
            pendingFollowUp: { $sum: 1 },
          },
        },
        { $sort: { pendingFollowUp: -1 } },
        { $limit: 6 },
      ]),
      this.guestModel.aggregate<{ _id: Types.ObjectId; guestsCaptured: number }>([
        {
          $match: {
            ...branchObjectIdFilter,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$branchId',
            guestsCaptured: { $sum: 1 },
          },
        },
      ]),
      this.memberModel.aggregate<{ _id: Types.ObjectId; membersAdded: number }>([
        {
          $match: {
            ...branchObjectIdFilter,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$branchId',
            membersAdded: { $sum: 1 },
          },
        },
      ]),
      this.attendanceModel.aggregate<{ _id: Types.ObjectId; newConverts: number }>([
        {
          $match: {
            ...branchObjectIdFilter,
            serviceDate: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$branchId',
            newConverts: { $sum: { $ifNull: ['$newConvertsCount', 0] } },
          },
        },
      ]),
    ]);

    const recentAttendanceMap = new Map(
      recentAttendanceByBranchRaw.map((item) => [String(item._id), item]),
    );
    const backlogMap = new Map(
      followUpBacklogRaw.map((item) => [String(item._id), item.pendingFollowUp]),
    );
    const guestsGrowthMap = new Map(
      growthGuestsRaw.map((item) => [String(item._id), item.guestsCaptured]),
    );
    const membersGrowthMap = new Map(
      growthMembersRaw.map((item) => [String(item._id), item.membersAdded]),
    );
    const convertsGrowthMap = new Map(
      growthConvertsRaw.map((item) => [String(item._id), item.newConverts]),
    );

    const growthSnapshots = branches.map((branch) => {
      const key = String(branch._id);
      const guestsCaptured = guestsGrowthMap.get(key) ?? 0;
      const membersAdded = membersGrowthMap.get(key) ?? 0;
      const newConverts = convertsGrowthMap.get(key) ?? 0;
      const growthScore = guestsCaptured + membersAdded + newConverts;

      return {
        _id: key,
        name: branch.name,
        oversightRegion: branch.oversightRegion,
        district: branch.district,
        guestsCaptured,
        membersAdded,
        newConverts,
        growthScore,
      };
    });

    const topGrowthBranches = [...growthSnapshots]
      .sort((left, right) => right.growthScore - left.growthScore || left.name.localeCompare(right.name))
      .slice(0, 5);
    const bottomGrowthBranches = [...growthSnapshots]
      .sort((left, right) => left.growthScore - right.growthScore || left.name.localeCompare(right.name))
      .slice(0, 5);

    const branchesWithoutRecentAttendance = branches
      .filter((branch) => !recentAttendanceMap.has(String(branch._id)))
      .slice(0, 6)
      .map((branch) => ({
        _id: String(branch._id),
        name: branch.name,
        oversightRegion: branch.oversightRegion,
        district: branch.district,
        city: branch.city,
        state: branch.state,
        status: branch.status,
        lastSubmittedAt: null,
      }));

    const highFollowUpBacklog = followUpBacklogRaw.map((item) => {
      const branch = branchMap.get(String(item._id));

      return {
        _id: String(item._id),
        name: branch?.name || 'Unknown branch',
        oversightRegion: branch?.oversightRegion || '',
        district: branch?.district || '',
        pendingFollowUp: item.pendingFollowUp,
      };
    });

    let operational: {
      recentGuests: unknown[];
      newestMembers: unknown[];
      attendanceMix: unknown[];
      followUpPipeline: unknown[];
    } | null = null;

    if (scope.showOperationalDetails) {
      const [recentGuests, newestMembers, attendanceMix, followUpPipelineRaw] = await Promise.all([
        this.guestModel.aggregate([
          { $match: branchObjectIdFilter },
          { $sort: { createdAt: -1 } },
          { $limit: 6 },
          {
            $lookup: {
              from: 'branches',
              localField: 'branchId',
              foreignField: '_id',
              as: 'branch',
            },
          },
          {
            $unwind: {
              path: '$branch',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              phone: 1,
              email: 1,
              visitStatus: 1,
              createdAt: 1,
              branchId: {
                _id: '$branch._id',
                name: '$branch.name',
              },
            },
          },
        ]),
        this.memberModel.aggregate([
          { $match: branchObjectIdFilter },
          { $sort: { createdAt: -1 } },
          { $limit: 6 },
          {
            $lookup: {
              from: 'branches',
              localField: 'branchId',
              foreignField: '_id',
              as: 'branch',
            },
          },
          {
            $unwind: {
              path: '$branch',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              title: 1,
              firstName: 1,
              lastName: 1,
              membershipStatus: 1,
              serviceUnitInterest: 1,
              createdAt: 1,
              branchId: {
                _id: '$branch._id',
                name: '$branch.name',
              },
            },
          },
        ]),
        this.attendanceModel.aggregate([
          {
            $match: {
              ...branchObjectIdFilter,
              serviceDate: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: { $ifNull: ['$serviceTypeLabel', '$serviceType'] },
              totalPeople: { $sum: this.attendanceTotalExpression() },
              firstTimers: { $sum: { $ifNull: ['$firstTimersCount', 0] } },
              newConverts: { $sum: { $ifNull: ['$newConvertsCount', 0] } },
              summarySubmissions: {
                $sum: { $cond: [{ $eq: ['$entryMode', 'summary'] }, 1, 0] },
              },
            },
          },
          { $sort: { totalPeople: -1 } },
          { $limit: 6 },
        ]),
        this.followUpModel.aggregate<{ _id: string; total: number }>([
          {
            $lookup: {
              from: 'guests',
              localField: 'guestId',
              foreignField: '_id',
              as: 'guest',
            },
          },
          { $unwind: '$guest' },
          ...this.buildGuestLookupMatch(branchLookupMatch),
          {
            $group: {
              _id: '$status',
              total: { $sum: 1 },
            },
          },
        ]),
      ]);

      const pipelineMap = new Map(followUpPipelineRaw.map((item) => [item._id, item.total]));
      operational = {
        recentGuests,
        newestMembers,
        attendanceMix,
        followUpPipeline: ['new', 'assigned', 'contacted', 'returned'].map((status) => ({
          status,
          total: pipelineMap.get(status) ?? 0,
        })),
      };
    }

    return {
      scope: {
        ...scope,
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      metrics: {
        totalGuests,
        totalMembers,
        totalAttendance: attendanceTotalsRaw[0]?.totalAttendance ?? 0,
        pendingFollowUp,
      },
      executive: {
        branchesWithoutRecentAttendance,
        highFollowUpBacklog,
        topGrowthBranches,
        bottomGrowthBranches,
      },
      operational,
    };
  }

  async summary(currentUser: AuthUser, branchId?: string, days = 30) {
    const branchObjectIdFilter = await this.accessScopeService.buildBranchObjectIdFilter(
      currentUser,
      branchId,
    );
    const query = await this.accessScopeService.buildBranchFilter(currentUser, branchId);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - Math.max(days - 1, 0));
    startDate.setHours(0, 0, 0, 0);

    const dateKeys = Array.from({ length: Math.max(days, 1) }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return date.toISOString().slice(0, 10);
    });

    const [guestsByDayRaw, attendanceByDayRaw, followUpBreakdown, serviceMix, branchTotals] =
      await Promise.all([
        this.guestModel.aggregate<{ _id: string; total: number }>([
          {
            $match: {
              ...branchObjectIdFilter,
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                },
              },
              total: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        this.attendanceModel.aggregate<{
          _id: string;
          total: number;
          firstTimers: number;
          newConverts: number;
        }>([
          {
            $match: {
              ...branchObjectIdFilter,
              serviceDate: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$serviceDate',
                },
              },
              total: { $sum: this.attendanceTotalExpression() },
              firstTimers: { $sum: { $ifNull: ['$firstTimersCount', 0] } },
              newConverts: { $sum: { $ifNull: ['$newConvertsCount', 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        this.followUpModel.aggregate<{ _id: string; total: number }>([
          {
            $lookup: {
              from: 'guests',
              localField: 'guestId',
              foreignField: '_id',
              as: 'guest',
            },
          },
          { $unwind: '$guest' },
          ...this.buildGuestLookupMatch(
            (branchObjectIdFilter as { branchId?: Types.ObjectId | { $in: Types.ObjectId[] } }).branchId,
          ),
          {
            $group: {
              _id: '$status',
              total: { $sum: 1 },
            },
          },
          { $sort: { total: -1 } },
        ]),
        this.attendanceModel.aggregate<{
          _id: string;
          totalPeople: number;
          firstTimers: number;
          newConverts: number;
          summarySubmissions: number;
          individualCheckins: number;
        }>([
          {
            $match: {
              ...branchObjectIdFilter,
              serviceDate: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: { $ifNull: ['$serviceTypeLabel', '$serviceType'] },
              totalPeople: { $sum: this.attendanceTotalExpression() },
              firstTimers: { $sum: { $ifNull: ['$firstTimersCount', 0] } },
              newConverts: { $sum: { $ifNull: ['$newConvertsCount', 0] } },
              summarySubmissions: {
                $sum: { $cond: [{ $eq: ['$entryMode', 'summary'] }, 1, 0] },
              },
              individualCheckins: {
                $sum: { $cond: [{ $eq: ['$entryMode', 'individual'] }, 1, 0] },
              },
            },
          },
          { $sort: { totalPeople: -1 } },
        ]),
        Promise.all([
          this.guestModel.countDocuments(query),
          this.memberModel.countDocuments(query),
          this.attendanceModel.aggregate<{
            attendanceTotal: number;
            firstTimersTotal: number;
            newConvertsTotal: number;
            summarySubmissionTotal: number;
            adultsTotal: number;
            childrenTotal: number;
          }>([
            {
              $match: {
                ...branchObjectIdFilter,
                serviceDate: { $gte: startDate, $lte: endDate },
              },
            },
            {
              $group: {
                _id: null,
                attendanceTotal: { $sum: this.attendanceTotalExpression() },
                firstTimersTotal: { $sum: { $ifNull: ['$firstTimersCount', 0] } },
                newConvertsTotal: { $sum: { $ifNull: ['$newConvertsCount', 0] } },
                summarySubmissionTotal: {
                  $sum: { $cond: [{ $eq: ['$entryMode', 'summary'] }, 1, 0] },
                },
                adultsTotal: { $sum: { $ifNull: ['$adultsCount', 0] } },
                childrenTotal: { $sum: { $ifNull: ['$childrenCount', 0] } },
              },
            },
          ]),
        ]),
      ]);

    const guestMap = new Map(guestsByDayRaw.map((entry) => [entry._id, entry.total]));
    const attendanceMap = new Map(attendanceByDayRaw.map((entry) => [entry._id, entry]));

    const trends = dateKeys.map((date) => ({
      date,
      guests: guestMap.get(date) ?? 0,
      attendance: attendanceMap.get(date)?.total ?? 0,
      firstTimers: attendanceMap.get(date)?.firstTimers ?? 0,
      newConverts: attendanceMap.get(date)?.newConverts ?? 0,
    }));

    const [guestTotal, memberTotal, attendanceTotalsRaw] = branchTotals;
    const attendanceTotals = attendanceTotalsRaw[0] ?? {
      attendanceTotal: 0,
      firstTimersTotal: 0,
      newConvertsTotal: 0,
      summarySubmissionTotal: 0,
      adultsTotal: 0,
      childrenTotal: 0,
    };
    const returnedGuests = followUpBreakdown.find((item) => item._id === 'returned')?.total ?? 0;
    const conversionRate = guestTotal > 0 ? Number(((memberTotal / guestTotal) * 100).toFixed(1)) : 0;
    const returnRate = guestTotal > 0 ? Number(((returnedGuests / guestTotal) * 100).toFixed(1)) : 0;

    return {
      range: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      totals: {
        guestTotal,
        memberTotal,
        attendanceTotal: attendanceTotals.attendanceTotal,
        firstTimersTotal: attendanceTotals.firstTimersTotal,
        newConvertsTotal: attendanceTotals.newConvertsTotal,
        summarySubmissionTotal: attendanceTotals.summarySubmissionTotal,
        adultsTotal: attendanceTotals.adultsTotal,
        childrenTotal: attendanceTotals.childrenTotal,
        conversionRate,
        returnRate,
      },
      trends,
      followUpBreakdown,
      serviceMix,
    };
  }

  async exportCsv(currentUser: AuthUser, branchId?: string, days = 30) {
    const summary = await this.summary(currentUser, branchId, days);

    const totalsRows = [
      ['metric', 'value'],
      ['guestTotal', String(summary.totals.guestTotal)],
      ['memberTotal', String(summary.totals.memberTotal)],
      ['attendanceTotal', String(summary.totals.attendanceTotal)],
      ['firstTimersTotal', String(summary.totals.firstTimersTotal)],
      ['newConvertsTotal', String(summary.totals.newConvertsTotal)],
      ['summarySubmissionTotal', String(summary.totals.summarySubmissionTotal)],
      ['adultsTotal', String(summary.totals.adultsTotal)],
      ['childrenTotal', String(summary.totals.childrenTotal)],
      ['conversionRate', String(summary.totals.conversionRate)],
      ['returnRate', String(summary.totals.returnRate)],
      ['days', String(summary.range.days)],
    ];

    const trendRows = [
      [],
      ['date', 'guests', 'attendance', 'firstTimers', 'newConverts'],
      ...summary.trends.map((item) => [
        item.date,
        String(item.guests),
        String(item.attendance),
        String(item.firstTimers),
        String(item.newConverts),
      ]),
    ];

    const followUpRows = [
      [],
      ['followUpStatus', 'total'],
      ...summary.followUpBreakdown.map((item) => [item._id, String(item.total)]),
    ];

    const serviceRows = [
      [],
      ['serviceType', 'totalPeople', 'firstTimers', 'newConverts', 'summarySubmissions', 'individualCheckins'],
      ...summary.serviceMix.map((item) => [
        item._id,
        String(item.totalPeople),
        String(item.firstTimers),
        String(item.newConverts),
        String(item.summarySubmissions),
        String(item.individualCheckins),
      ]),
    ];

    return [...totalsRows, ...trendRows, ...followUpRows, ...serviceRows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }
}
