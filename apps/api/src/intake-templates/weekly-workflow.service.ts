import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Branch } from '../branches/schemas/branch.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PushService } from '../push/push.service';
import { User } from '../users/schemas/user.schema';
import { IntakeSubmission } from './schemas/intake-submission.schema';
import { IntakeTemplate } from './schemas/intake-template.schema';
import { WeeklyDistrictPacket } from './weekly-workflow.schema';
import {
  ForwardWeeklyDto,
  ReviewPacketDto,
  ReviewWeeklyDto,
  SaveWeeklyDto,
} from './weekly-workflow.dto';
import { weeklyComparisons } from './weekly-comparisons';

export const WEEKLY_FIGURES = [
  'currentAttendance',
  'firstTimersCount',
  'newConvertsCount',
  'believersFoundationClassCount',
  'holySpiritBaptismCount',
  'waterBaptismCount',
  'covenantHourOfPrayerAttendance',
  'winnersSatelliteFellowshipAverage',
  'cellCount',
  'newCellCount',
  'wofbiAttendance',
] as const;
const REVIEW_ROLES = [
  'super_admin',
  'national_admin',
  'national_pastor',
  'district_admin',
  'district_pastor',
];
export function reportWeek(value: string) {
  const date = new Date(value.slice(0, 10) + 'T00:00:00Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value.slice(0, 10)
  )
    throw new BadRequestException('Choose a valid report week.');
  date.setUTCDate(date.getUTCDate() + ((7 - date.getUTCDay()) % 7));
  const from = new Date(date);
  from.setUTCDate(from.getUTCDate() - 6);
  return { date, from };
}
export function validateWeeklyFigures(
  figures: Record<string, unknown>,
  submit = false,
) {
  if (
    Object.keys(figures).some(
      (key) => !(WEEKLY_FIGURES as readonly string[]).includes(key),
    )
  )
    throw new BadRequestException('Unknown weekly report figure.');
  for (const [key, value] of Object.entries(figures))
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > Number.MAX_SAFE_INTEGER ||
      (key !== 'winnersSatelliteFellowshipAverage' && !Number.isSafeInteger(value))
    )
      throw new BadRequestException(
        'Enter non-negative whole numbers within the supported range. The WSF average may include decimals.',
      );
  const attendance = figures.currentAttendance;
  if (typeof attendance === 'number') {
    const limits = [
      ['firstTimersCount', 'First timers'],
      ['newConvertsCount', 'New converts'],
    ] as const;
    for (const [key, label] of limits) {
      const count = figures[key];
      if (typeof count === 'number' && count > attendance) {
        throw new BadRequestException(`${label} cannot exceed current attendance.`);
      }
    }
  }
  if (submit && WEEKLY_FIGURES.some((key) => figures[key] === undefined))
    throw new BadRequestException(
      'Complete every figure before submitting; enter zero where applicable.',
    );
  return figures as Partial<Record<(typeof WEEKLY_FIGURES)[number], number>>;
}

@Injectable()
export class WeeklyWorkflowService {
  constructor(
    @InjectModel(IntakeSubmission.name)
    private readonly reports: Model<IntakeSubmission>,
    @InjectModel(IntakeTemplate.name)
    private readonly templates: Model<IntakeTemplate>,
    @InjectModel(Branch.name) private readonly branches: Model<Branch>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(WeeklyDistrictPacket.name)
    private readonly packets: Model<WeeklyDistrictPacket>,
    private readonly scope: AccessScopeService,
    private readonly audit: AuditLogsService,
    private readonly push: PushService,
  ) {}
  private async reviewer(user: AuthUser, district: string, region: string) {
    if (!REVIEW_ROLES.includes(user.role)) {
      const appointments = await this.scope.oversightAssignments(user);
      if (
        !appointments.some(
          (a) =>
            a.kind === 'district' &&
            a.branchQuery.district === district &&
            a.branchQuery.oversightRegion === region,
        )
      )
        throw new ForbiddenException(
          'District oversight permission is required.',
        );
    }
    const all = await this.branches
      .find({ district, oversightRegion: region })
      .select('_id')
      .lean();
    const visible = await this.branches.countDocuments({
      $and: [
        { district, oversightRegion: region },
        await this.scope.getBranchDocumentQuery(user),
      ],
    });
    if (!all.length || visible !== all.length)
      throw new ForbiddenException(
        'You must have access to this entire district.',
      );
    return all;
  }
  async defaults(user: AuthUser, branchId: string, weekEnding: string) {
    await this.scope.ensureBranchAccess(user, branchId);
    const { from, date } = reportWeek(weekEnding);
    const historical = await this.reports
      .find({
        branchId,
        templateKind: 'weekly_report',
        status: 'approved',
        serviceDate: {
          $gte: new Date(Date.UTC(from.getUTCFullYear() - 1, 0, 1)),
          $lt: from,
        },
      })
      .select('serviceDate currentAttendance updatedAt')
      .lean();
    return weeklyComparisons(historical, from, date);
  }
  async list(
    user: AuthUser,
    weekEnding: string,
    district?: string,
    region?: string,
  ) {
    const { date, from } = reportWeek(weekEnding);
    const branches = await this.branches
      .find({
        $and: [
          await this.scope.getBranchDocumentQuery(user),
          ...(district ? [{ district }] : []),
          ...(region ? [{ oversightRegion: region }] : []),
        ],
      })
      .select('name district oversightRegion')
      .sort({ name: 1 })
      .lean();
    const reports = await this.reports
      .find({
        branchId: { $in: branches.map((b) => b._id) },
        templateKind: 'weekly_report',
        serviceDate: { $gte: from, $lte: date },
      })
      .sort({ updatedAt: -1 })
      .lean();
    const rows = branches.map((branch) => {
      const report =
        reports.find(
          (r) =>
            String(r.branchId) === String(branch._id) &&
            r.status === 'approved',
        ) ?? reports.find((r) => String(r.branchId) === String(branch._id));
      return { branch, report: report ?? null };
    });
    const acknowledged = rows.flatMap((row) =>
      row.report?.status === 'approved' ? [row.report] : [],
    );
    const totals: Record<string, number | null> = {};
    for (const key of [
      ...WEEKLY_FIGURES,
      'previousAttendance',
      'averageLastYear',
      'averageLastPeriod',
    ] as const)
      totals[key] =
        acknowledged.length && acknowledged.every((r) => r[key] !== undefined)
          ? acknowledged.reduce((sum, r) => sum + (r[key] ?? 0), 0)
          : null;
    totals.growth =
      totals.currentAttendance !== null && totals.previousAttendance !== null
        ? totals.currentAttendance - totals.previousAttendance
        : null;
    totals.growthPercent =
      totals.growth !== null &&
      totals.previousAttendance !== null &&
      totals.previousAttendance > 0
        ? Math.round((totals.growth / totals.previousAttendance) * 10000) / 100
        : null;
    return {
      canReview:
        REVIEW_ROLES.includes(user.role) ||
        (await this.scope.oversightAssignments(user)).some(
          (a) => a.kind === 'district',
        ),
      weekEnding: date.toISOString(),
      rows,
      totals,
      coverage: {
        total: rows.length,
        acknowledged: acknowledged.length,
        missing: rows.filter((r) => !r.report).length,
        pending: rows.filter((r) => r.report?.status === 'pending').length,
      },
    };
  }
  async save(user: AuthUser, dto: SaveWeeklyDto, id?: string) {
    await this.scope.ensureBranchAccess(user, dto.branchId);
    const { date, from } = reportWeek(dto.weekEnding);
    if (from.getTime() > Date.now())
      throw new BadRequestException('Future weekly reports cannot be created.');
    const figures = validateWeeklyFigures(dto.figures, dto.submit);
    const baseline = await this.defaults(user, dto.branchId, dto.weekEnding);
    const growth =
      figures.currentAttendance !== undefined &&
      baseline.previousAttendance !== undefined
        ? figures.currentAttendance - baseline.previousAttendance
        : undefined;
    const payload = {
      submittedBy: new Types.ObjectId(user.sub),
      ...figures,
      ...baseline,
      growth,
      growthPercent:
        growth !== undefined && (baseline.previousAttendance ?? 0) > 0
          ? Math.round((growth / baseline.previousAttendance!) * 10000) / 100
          : undefined,
      remarks: dto.remarks?.trim() ?? '',
      status: dto.submit ? 'pending' : 'draft',
      answers: {
        ...figures,
        ...baseline,
        reportWeek: date.toISOString().slice(0, 10),
        remarks: dto.remarks?.trim() ?? '',
      },
    };
    let saved;
    if (id) {
      const existing = await this.reports
        .findOne({ _id: id, templateKind: 'weekly_report' })
        .lean();
      if (!existing) throw new NotFoundException('Weekly report not found.');
      if (
        String(existing.branchId) !== dto.branchId ||
        !existing.serviceDate ||
        reportWeek(existing.serviceDate.toISOString()).date.getTime() !==
          date.getTime()
      )
        throw new BadRequestException('The church and week cannot change.');
      if (dto.revision !== (existing.workflowRevision ?? 0))
        throw new ConflictException(
          'This report changed. Refresh before saving.',
        );
      if (existing.status === 'approved')
        throw new ConflictException('Acknowledged reports are locked.');
      saved = await this.reports.findOneAndUpdate(
        {
          _id: id,
          status: { $ne: 'approved' },
          workflowRevision:
            existing.workflowRevision === undefined
              ? { $exists: false }
              : (dto.revision ?? 0),
        },
        {
          $set: payload,
          $unset: Object.fromEntries(
            [
              ...WEEKLY_FIGURES,
              'previousAttendance',
              'averageLastYear',
              'averageLastPeriod',
              'growth',
              'growthPercent',
            ]
              .filter(
                (key) =>
                  (payload as Record<string, unknown>)[key] === undefined,
              )
              .map((key) => [key, 1]),
          ),
          $inc: { workflowRevision: 1 },
        },
        { new: true },
      );
      if (!saved)
        throw new ConflictException(
          'This report changed. Refresh before saving.',
        );
    } else {
      if (
        await this.reports.exists({
          branchId: dto.branchId,
          templateKind: 'weekly_report',
          serviceDate: { $gte: from, $lte: date },
        })
      )
        throw new ConflictException(
          'A report already exists for this church and week. Open it to continue.',
        );
      const template = await this.templates
        .findOne({ slug: 'weekly-spiritual-indices' })
        .lean();
      if (!template)
        throw new BadRequestException('Weekly report template is not ready.');
      try {
        saved = await this.reports.create({
          ...payload,
          templateId: template._id,
          templateName: template.name,
          templateKind: 'weekly_report',
          branchId: dto.branchId,
          serviceDate: date,
          serviceType: 'weekly_spiritual_indices',
          workflowKey: dto.branchId + ':' + date.toISOString().slice(0, 10),
          workflowRevision: 0,
          submittedBy: new Types.ObjectId(user.sub),
        });
      } catch (error) {
        if ((error as { code?: number }).code === 11000)
          throw new ConflictException(
            'A weekly report already exists for this church and week. Open it to continue.',
          );
        throw error;
      }
    }
    await this.audit.record({
      actor: user,
      entityType: 'weekly_report',
      entityId: String(saved._id),
      action: dto.submit ? 'submitted' : 'saved',
      summary: 'Weekly spiritual report saved',
      branchId: dto.branchId,
    });
    if (dto.submit)
      this.push.notifyDistrictTeam(dto.branchId, {
        title: 'Weekly report submitted',
        body: 'A station weekly report is ready for acknowledgement.',
        url: '/weekly-reports',
      });
    return saved;
  }
  async review(user: AuthUser, id: string, dto: ReviewWeeklyDto) {
    const report = await this.reports
      .findOne({ _id: id, templateKind: 'weekly_report' })
      .lean();
    if (!report) throw new NotFoundException('Weekly report not found.');
    if (dto.revision !== (report.workflowRevision ?? 0))
      throw new ConflictException(
        'The report changed after you opened it. Refresh.',
      );
    const branch = await this.branches.findById(report.branchId).lean();
    if (!branch) throw new NotFoundException('Church not found.');
    await this.reviewer(user, branch.district!, branch.oversightRegion!);
    if (String(report.submittedBy) === user.sub)
      throw new ForbiddenException(
        'A different person must acknowledge this report.',
      );
    const saved = await this.reports.findOneAndUpdate(
      {
        _id: id,
        status: 'pending',
        workflowRevision:
          report.workflowRevision === undefined
            ? { $exists: false }
            : dto.revision,
      },
      {
        $set:
          dto.decision === 'approved'
            ? {
                status: 'approved',
                approvedBy: user.sub,
                approvedAt: new Date(),
              }
            : {
                status: 'rejected',
                rejectedBy: user.sub,
                rejectedAt: new Date(),
              },
        $inc: { workflowRevision: 1 },
      },
      { new: true },
    );
    if (!saved)
      throw new ConflictException(
        'Report changed or already reviewed. Refresh.',
      );
    await this.audit.record({
      actor: user,
      entityType: 'weekly_report',
      entityId: id,
      action: dto.decision,
      summary: 'Weekly report reviewed',
      branchId: String(branch._id),
    });
    return saved;
  }
  async recipients(user: AuthUser, district: string, region: string) {
    await this.reviewer(user, district, region);
    const candidates = await this.users
      .find({
        isActive: true,
        role: { $in: [...REVIEW_ROLES, 'resident_pastor'] },
      })
      .select('firstName lastName role oversightRegion district branchId email')
      .lean();
    const result: { _id: string; name: string; role: string }[] = [];
    for (const candidate of candidates) {
      if (String(candidate._id) === user.sub) continue;
      try {
        await this.reviewer(
          {
            ...candidate,
            sub: String(candidate._id),
            branchId: candidate.branchId
              ? String(candidate.branchId)
              : undefined,
          } as AuthUser,
          district,
          region,
        );
        result.push({
          _id: String(candidate._id),
          name: candidate.firstName + ' ' + candidate.lastName,
          role: candidate.role,
        });
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    return result;
  }
  async forward(user: AuthUser, dto: ForwardWeeklyDto) {
    const branches = await this.reviewer(
      user,
      dto.district,
      dto.oversightRegion,
    );
    if (
      !(await this.recipients(user, dto.district, dto.oversightRegion)).some(
        (r) => r._id === dto.recipientId,
      )
    )
      throw new ForbiddenException('Select a reviewer with district access.');
    const snapshot = await this.list(
      user,
      dto.weekEnding,
      dto.district,
      dto.oversightRegion,
    );
    if (!snapshot.coverage.acknowledged)
      throw new BadRequestException(
        'Acknowledge at least one station report before forwarding.',
      );
    // Snapshot is copied once; future station edits cannot alter a sent packet.
    const packet = await this.packets.create({
      ...dto,
      weekEnding: reportWeek(dto.weekEnding).date,
      branchIds: branches.map((b) => b._id),
      createdBy: user.sub,
      status: 'submitted',
      snapshot,
    });
    this.push.notifyUsers([dto.recipientId], {
      title: 'District weekly report',
      body: 'A consolidated district report is ready for review.',
      url: '/weekly-reports/workspace',
    });
    await this.audit.record({
      actor: user,
      entityType: 'weekly_district_packet',
      entityId: String(packet._id),
      action: 'submitted',
      summary: 'Consolidated district weekly report forwarded',
      metadata: { district: dto.district, recipientId: dto.recipientId },
    });
    return packet;
  }
  async packetList(user: AuthUser) {
    const packets = await this.packets
      .find({ $or: [{ createdBy: user.sub }, { recipientId: user.sub }] })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const visible: typeof packets = [];
    for (const packet of packets) {
      try {
        await this.reviewer(user, packet.district, packet.oversightRegion);
        visible.push(packet);
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    return visible;
  }
  async reviewPacket(user: AuthUser, id: string, dto: ReviewPacketDto) {
    const packet = await this.packets.findById(id).lean();
    if (!packet) throw new NotFoundException('District packet not found.');
    if (String(packet.recipientId) !== user.sub)
      throw new ForbiddenException(
        'Only the selected recipient can review this packet.',
      );
    await this.reviewer(user, packet.district, packet.oversightRegion);
    const changed = await this.packets.findOneAndUpdate(
      { _id: id, status: 'submitted', recipientId: user.sub },
      {
        $set: {
          status: dto.decision,
          reviewNote: dto.note ?? '',
          reviewedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!changed)
      throw new ConflictException('This packet has already been reviewed.');
    await this.audit.record({
      actor: user,
      entityType: 'weekly_district_packet',
      entityId: id,
      action: dto.decision,
      summary: 'District weekly report reviewed',
    });
    this.push.notifyUsers([String(packet.createdBy)], {
      title: 'District report reviewed',
      body: 'Your district weekly report has been reviewed.',
      url: '/weekly-reports/workspace',
    });
    return changed;
  }
}
