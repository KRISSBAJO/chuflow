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
import { Branch } from '../branches/schemas/branch.schema';
import { District } from '../districts/schemas/district.schema';
import { User } from '../users/schemas/user.schema';
import { HierarchyUnit } from '../hierarchy/hierarchy.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  ApprovalPolicy,
  ApprovalRequest,
  ApprovalNotice,
  LEVELS,
  type ApprovalLevel,
  type ApprovalStage,
} from './approval.schema';
import {
  ApprovalDecisionDto,
  ApprovalQueryDto,
  SaveApprovalPolicyDto,
  SubmitApprovalDto,
} from './approval.dto';
import {
  ensureDecisionAllowed,
  finalApprovalLevel,
  nextApprovalState,
  validatePolicyLevels,
  validateStages,
} from './approval.logic';
@Injectable()
export class ApprovalWorkflowsService {
  constructor(
    @InjectModel(ApprovalPolicy.name)
    private readonly policies: Model<ApprovalPolicy>,
    @InjectModel(ApprovalRequest.name)
    private readonly requests: Model<ApprovalRequest>,
    @InjectModel(ApprovalNotice.name)
    private readonly notices: Model<ApprovalNotice>,
    @InjectModel(Branch.name) private readonly branches: Model<Branch>,
    @InjectModel(District.name) private readonly districts: Model<District>,
    @InjectModel(HierarchyUnit.name)
    private readonly units: Model<HierarchyUnit>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly scope: AccessScopeService,
  ) {}
  private id(value: string) {
    if (!Types.ObjectId.isValid(value))
      throw new BadRequestException('Invalid approval record.');
    return new Types.ObjectId(value);
  }
  private canManage(u: AuthUser) {
    return ['super_admin', 'national_admin'].includes(u.role);
  }
  private async branch(u: AuthUser, id: string) {
    const branch = await this.branches
      .findOne({
        $and: [
          { _id: this.id(id), status: 'active' },
          await this.scope.getBranchDocumentQuery(u),
        ],
      })
      .lean();
    if (!branch)
      throw new ForbiddenException(
        'This church is outside your access or inactive.',
      );
    return branch;
  }
  async options(u: AuthUser) {
    const branches = await this.branches
      .find({
        $and: [
          await this.scope.getBranchDocumentQuery(u),
          { status: 'active' },
        ],
      })
      .select('_id name oversightRegion')
      .sort({ name: 1 })
      .lean();
    const regions = [...new Set(branches.map((b) => b.oversightRegion))];
    if (u.oversightRegion && !regions.includes(u.oversightRegion))
      regions.push(u.oversightRegion);
    const policies = await this.policies
      .find({
        ...(u.role === 'super_admin'
          ? {}
          : { oversightRegion: { $in: regions } }),
        ...(this.canManage(u) ? {} : { isActive: true }),
      })
      .sort({ name: 1 })
      .lean();
    return { branches, policies, regions, canManage: this.canManage(u) };
  }
  async savePolicy(u: AuthUser, dto: SaveApprovalPolicyDto, id?: string) {
    if (
      !this.canManage(u) ||
      (u.role !== 'super_admin' && u.oversightRegion !== dto.oversightRegion)
    )
      throw new ForbiddenException(
        'Only the overall or matching national administrator can configure routes.',
      );
    validatePolicyLevels(
      dto.finalLevel,
      dto.thresholdAmount,
      dto.aboveThresholdLevel,
    );
    const value = {
      oversightRegion: dto.oversightRegion.trim(),
      name: dto.name.trim(),
      category: dto.category.trim(),
      finalLevel: dto.finalLevel,
      thresholdAmount: dto.thresholdAmount,
      aboveThresholdLevel:
        dto.thresholdAmount === undefined ? undefined : dto.aboveThresholdLevel,
      currency: dto.currency,
      reviewDays: dto.reviewDays,
      isActive: dto.isActive,
    };
    if (
      value.name.length < 2 ||
      value.category.length < 2 ||
      value.oversightRegion.length < 2
    )
      throw new BadRequestException('Name and category are required.');
    if (!id)
      return this.policies.create({
        ...value,
        history: [this.event(u, 'route_created', JSON.stringify(value))],
      });
    if (dto.expectedRevision === undefined)
      throw new BadRequestException('Reload the route before editing.');
    const existing = await this.policies.findById(this.id(id)).lean();
    if (
      !existing ||
      (u.role !== 'super_admin' &&
        existing.oversightRegion !== u.oversightRegion)
    )
      throw new ForbiddenException('Route is outside your access.');
    if (existing.oversightRegion !== value.oversightRegion)
      throw new BadRequestException(
        'A route cannot be moved to another national area.',
      );
    const { thresholdAmount, aboveThresholdLevel, ...required } = value;
    const updated = await this.policies
      .findOneAndUpdate(
        { _id: existing._id, revision: dto.expectedRevision },
        {
          $set: {
            ...required,
            ...(thresholdAmount !== undefined
              ? { thresholdAmount, aboveThresholdLevel }
              : {}),
          },
          ...(thresholdAmount === undefined
            ? { $unset: { thresholdAmount: 1, aboveThresholdLevel: 1 } }
            : {}),
          $push: {
            history: this.event(u, 'route_updated', JSON.stringify(value)),
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean();
    if (!updated)
      throw new ConflictException('Route changed. Reload before saving.');
    return updated;
  }
  private async candidates(
    filter: Record<string, unknown>,
    requesterId: string,
  ) {
    return this.users
      .find({
        ...filter,
        isActive: true,
        _id: {
          ...(filter._id ? { $eq: filter._id } : {}),
          $ne: this.id(requesterId),
        },
      })
      .select('_id firstName lastName')
      .sort({ lastName: 1 })
      .lean();
  }
  private async route(
    branch: Branch & { _id: Types.ObjectId },
    finalLevel: ApprovalLevel,
    requesterId: string,
  ) {
    const stages: ApprovalStage[] = [];
    const churchPeople = await this.candidates(
      {
        branchId: branch._id,
        role: { $in: ['resident_pastor', 'branch_admin'] },
      },
      requesterId,
    );
    stages.push({
      level: 'church',
      label: branch.name + ' � Church',
      reviewerIds: churchPeople.map((p) => String(p._id)),
      reviewerNames: churchPeople.map((p) => `${p.firstName} ${p.lastName}`),
    });
    const district = await this.districts
      .findOne({
        name: branch.district,
        oversightRegion: branch.oversightRegion,
        isActive: true,
      })
      .lean();
    for (const level of ['area', 'zone', 'district'] as const) {
      if (LEVELS.indexOf(level) > LEVELS.indexOf(finalLevel)) break;
      const ref =
        level === 'area'
          ? branch.areaId
          : level === 'zone'
            ? branch.zoneId
            : undefined;
      // A structurally absent intermediate level can be skipped; a configured but invalid level cannot.
      if (level !== 'district' && !ref) {
        if (finalLevel === level)
          throw new BadRequestException(
            `Place this church in an ${level} before using this route.`,
          );
        continue;
      }
      const unit = district
        ? await this.units
            .findOne({
              ...(ref ? { _id: ref } : {}),
              kind: level,
              districtId: district._id,
              isActive: true,
            })
            .lean()
        : null;
      if (!unit)
        throw new BadRequestException(
          `The ${level} level is missing or inactive. Update the church hierarchy.`,
        );
      const expectedQuery = await this.scope.unitBranchQuery(String(unit._id));
      if (
        !(await this.branches.exists({
          $and: [{ _id: branch._id }, expectedQuery],
        }))
      )
        throw new BadRequestException(
          'The church hierarchy is inconsistent. Correct its placement.',
        );
      if (unit.pastorVisibilityEnabled !== true)
        throw new BadRequestException(
          `An administrator must enable the appointed pastor's oversight access for ${unit.name} before using this approval route.`,
        );
      const people =
        unit.pastorUserId && unit.headquartersBranchId
          ? await this.candidates(
              {
                _id: unit.pastorUserId,
                branchId: unit.headquartersBranchId,
                role: 'resident_pastor',
              },
              requesterId,
            )
          : [];
      stages.push({
        level,
        label: `${unit.name} � ${level === 'zone' ? 'Zone' : level[0].toUpperCase() + level.slice(1)}`,
        unitId: String(unit._id),
        reviewerIds: people.map((p) => String(p._id)),
        reviewerNames: people.map((p) => `${p.firstName} ${p.lastName}`),
      });
    }
    if (finalLevel === 'national') {
      const people = await this.candidates(
        { role: 'national_pastor', oversightRegion: branch.oversightRegion },
        requesterId,
      );
      stages.push({
        level: 'national',
        label: branch.oversightRegion + ' � National',
        reviewerIds: people.map((p) => String(p._id)),
        reviewerNames: people.map((p) => `${p.firstName} ${p.lastName}`),
      });
    }
    return validateStages(stages, finalLevel);
  }
  private event(u: AuthUser, action: string, note: string, level?: string) {
    return {
      actorId: u.sub,
      actorName: u.email,
      action,
      note,
      level,
      at: new Date(),
    };
  }
  private due(days: number) {
    return new Date(Date.now() + days * 86400000);
  }
  async preview(u: AuthUser, dto: SubmitApprovalDto) {
    const branch = await this.branch(u, dto.branchId);
    const policy = await this.policies
      .findOne({
        _id: this.id(dto.policyId),
        oversightRegion: branch.oversightRegion,
        isActive: true,
      })
      .lean();
    if (!policy)
      throw new BadRequestException(
        'Choose an active route for this church�s national area.',
      );
    const finalLevel = finalApprovalLevel(policy, dto.amount);
    const stages = await this.route(branch, finalLevel, u.sub);
    return { branch, policy, stages, finalLevel };
  }
  async submit(u: AuthUser, dto: SubmitApprovalDto, id?: string) {
    if (dto.title.trim().length < 3 || dto.details.trim().length < 10)
      throw new BadRequestException(
        'Enter a title and enough detail for reviewers.',
      );
    const { branch, policy, stages, finalLevel } = await this.preview(u, dto);
    const values = {
      branchId: branch._id,
      branchName: branch.name,
      oversightRegion: branch.oversightRegion,
      policyId: policy._id,
      policyName: policy.name,
      category: policy.category,
      title: dto.title.trim(),
      details: dto.details.trim(),
      documentLinks: dto.documentLinks || [],
      amount: dto.amount,
      currency: policy.currency,
      finalLevel,
      stages,
      currentStage: 0,
      currentReviewerIds: stages[0].reviewerIds,
      status: 'pending',
      reviewDays: policy.reviewDays,
      dueAt: this.due(policy.reviewDays),
      nextReminderAt: this.due(policy.reviewDays),
    };
    let request: (ApprovalRequest & { _id: Types.ObjectId }) | null;
    if (id) {
      const old = await this.requests
        .findOne({
          _id: this.id(id),
          requesterId: u.sub,
          status: 'returned',
          revision: dto.expectedRevision,
        })
        .lean();
      if (!old)
        throw new ConflictException(
          'Only your returned, unchanged request can be resubmitted.',
        );
      if (String(old.branchId) !== dto.branchId)
        throw new BadRequestException(
          'Keep the request in its original church.',
        );
      request = await this.requests
        .findOneAndUpdate(
          { _id: old._id, revision: dto.expectedRevision, status: 'returned' },
          {
            $set: values,
            ...(dto.amount === undefined ? { $unset: { amount: 1 } } : {}),
            $inc: { revision: 1 },
            $push: {
              history: {
                ...this.event(
                  u,
                  'resubmitted',
                  'Revised request submitted for a fresh review.',
                ),
                submission: values,
              },
            },
          },
          { new: true },
        )
        .lean();
      if (!request) throw new ConflictException('Request changed. Reload.');
    } else {
      request = await this.requests.create({
        ...values,
        requesterId: u.sub,
        requesterName: u.email,
        participantIds: [u.sub],
        history: [
          {
            ...this.event(u, 'submitted', 'Request submitted.'),
            submission: values,
          },
        ],
      });
    }
    return request;
  }
  private async visibility(u: AuthUser) {
    if (u.role === 'super_admin') return {};
    const eligible: Record<string, unknown>[] = [];
    const currentLevel = { $arrayElemAt: ['$stages.level', '$currentStage'] };
    if (['resident_pastor', 'branch_admin'].includes(u.role) && u.branchId)
      eligible.push({
        branchId: this.id(u.branchId),
        $expr: { $eq: [currentLevel, 'church'] },
      });
    if (u.role === 'national_pastor' && u.oversightRegion)
      eligible.push({
        oversightRegion: u.oversightRegion,
        $expr: { $eq: [currentLevel, 'national'] },
      });
    if (u.role === 'resident_pastor') {
      const units = await this.scope.oversightAssignments(u);
      if (units.length)
        eligible.push({
          $expr: {
            $in: [
              {
                $let: {
                  vars: {
                    current: { $arrayElemAt: ['$stages', '$currentStage'] },
                  },
                  in: '$$current.unitId',
                },
              },
              units.map((unit) => String(unit._id)),
            ],
          },
        });
    }
    const branchIds = await this.scope.getAccessibleBranchIds(u);
    return {
      $and: [
        ...(branchIds === null
          ? []
          : [{ branchId: { $in: branchIds.map((id) => this.id(id)) } }]),
        {
          $or: [
            { requesterId: u.sub },
            { participantIds: u.sub },
            ...(eligible.length
              ? [
                  {
                    currentReviewerIds: u.sub,
                    status: 'pending',
                    $or: eligible,
                  },
                ]
              : []),
          ],
        },
      ],
    };
  }
  async list(u: AuthUser, q: ApprovalQueryDto) {
    const branchIds = await this.scope.getAccessibleBranchIds(u);
    const clauses: Record<string, unknown>[] = [await this.visibility(u)];
    if (branchIds)
      clauses.push({ branchId: { $in: branchIds.map((id) => this.id(id)) } });
    if (q.view === 'mine') clauses.push({ requesterId: u.sub });
    if (q.view === 'review')
      clauses.push({ currentReviewerIds: u.sub, status: 'pending' });
    if (q.view === 'overdue')
      clauses.push({ status: 'pending', dueAt: { $lt: new Date() } });
    if (q.status) clauses.push({ status: q.status });
    if (q.search?.trim())
      clauses.push({
        title: {
          $regex: q.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          $options: 'i',
        },
      });
    const filter = { $and: clauses },
      page = Math.max(1, Number(q.page) || 1),
      limit = 20;
    const [items, total] = await Promise.all([
      this.requests
        .find(filter)
        .select('-details -history -documentLinks')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.requests.countDocuments(filter),
    ]);
    return {
      items,
      pagination: {
        page,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
  async detail(u: AuthUser, id: string) {
    const r = await this.requests
      .findOne({ _id: this.id(id), ...(await this.visibility(u)) })
      .lean();
    if (!r) throw new NotFoundException('Request not found.');
    await this.branch(u, String(r.branchId));
    return {
      ...r,
      canReview:
        r.status === 'pending' &&
        r.requesterId !== u.sub &&
        r.currentReviewerIds.includes(u.sub),
      canManage: u.role === 'super_admin',
    };
  }
  async decide(u: AuthUser, id: string, dto: ApprovalDecisionDto) {
    const r = await this.detail(u, id);
    if (r.revision !== dto.expectedRevision)
      throw new ConflictException(
        'Another reviewer updated this request. Reload before deciding.',
      );
    if (dto.note.trim().length < 3)
      throw new BadRequestException('Record the reason for your decision.');
    const stage = r.stages[r.currentStage];
    let changes: Record<string, unknown>;
    let action = dto.action;
    if (dto.action === 'withdraw') {
      if (
        r.requesterId !== u.sub ||
        !['pending', 'returned'].includes(r.status)
      )
        throw new ForbiddenException(
          'Only the requester can withdraw an open request.',
        );
      changes = { status: 'withdrawn', currentReviewerIds: [] };
    } else if (
      dto.action === 'return' &&
      u.role === 'super_admin' &&
      r.requesterId !== u.sub &&
      r.status === 'pending'
    ) {
      changes = { status: 'returned', currentReviewerIds: [] };
    } else {
      ensureDecisionAllowed(r, u.sub);
      // Recheck the live appointment and access. A stale snapshot never grants authority.
      const branch = await this.branch(u, String(r.branchId));
      const live = await this.route(branch, r.finalLevel, r.requesterId);
      const current = live.find((s) => s.level === stage.level);
      if (!current?.reviewerIds.includes(u.sub))
        throw new ForbiddenException(
          'Your appointment changed. Ask an overall administrator to return this request for rerouting.',
        );
      if (dto.action === 'escalate') {
        if (
          !dto.targetLevel ||
          LEVELS.indexOf(dto.targetLevel) <= LEVELS.indexOf(r.finalLevel) ||
          r.currentStage !== r.stages.length - 1
        )
          throw new BadRequestException(
            'Only the final reviewer can escalate to a higher final level.',
          );
        const full = await this.route(branch, dto.targetLevel, r.requesterId);
        const extra = full.filter(
          (s) => LEVELS.indexOf(s.level) > LEVELS.indexOf(r.finalLevel),
        );
        const stages = [...r.stages, ...extra];
        changes = {
          stages,
          finalLevel: dto.targetLevel,
          ...nextApprovalState(stages, r.currentStage),
        };
      } else if (dto.action === 'advance') {
        changes = nextApprovalState(r.stages, r.currentStage);
        action = changes.status === 'approved' ? 'approved' : 'recommended';
      } else
        changes = {
          status: dto.action === 'reject' ? 'rejected' : 'returned',
          currentReviewerIds: [],
        };
    }
    const updated = await this.requests
      .findOneAndUpdate(
        { _id: r._id, revision: dto.expectedRevision, status: r.status },
        {
          $set: {
            ...changes,
            dueAt: this.due(r.reviewDays),
            nextReminderAt: this.due(r.reviewDays),
          },
          $inc: { revision: 1 },
          $addToSet: { participantIds: u.sub },
          $push: {
            history: this.event(u, action, dto.note.trim(), stage?.level),
          },
        },
        { new: true },
      )
      .lean();
    if (!updated)
      throw new ConflictException('Request changed. Reload before deciding.');
    return updated;
  }
  // Durable notification jobs are recovered from request revisions, even if the web request stops after saving.
  async queueNotices() {
    const recent = await this.requests
      .find({
        $or: [
          {
            $expr: {
              $ne: [{ $ifNull: ['$notificationRevision', -1] }, '$revision'],
            },
          },
          { status: 'pending', nextReminderAt: { $lte: new Date() } },
        ],
      })
      .select(
        '_id requesterId currentReviewerIds revision status nextReminderAt',
      )
      .sort({ updatedAt: 1 })
      .limit(200)
      .lean();
    for (const r of recent) {
      const ids = [...new Set([r.requesterId, ...r.currentReviewerIds])];
      for (const userId of ids)
        await this.notices.updateOne(
          { key: `${String(r._id)}:${r.revision}:${userId}` },
          {
            $setOnInsert: {
              userId,
              requestId: String(r._id),
              status: 'pending',
              attempts: 0,
              availableAt: new Date(),
            },
          },
          { upsert: true },
        );
      await this.requests.updateOne(
        { _id: r._id, revision: r.revision },
        { $set: { notificationRevision: r.revision } },
      );
      if (
        r.status === 'pending' &&
        r.nextReminderAt &&
        r.nextReminderAt <= new Date()
      ) {
        const claim = await this.requests.updateOne(
          {
            _id: r._id,
            revision: r.revision,
            nextReminderAt: r.nextReminderAt,
          },
          { $set: { nextReminderAt: this.due(1) } },
        );
        if (claim.modifiedCount)
          for (const userId of new Set(r.currentReviewerIds))
            await this.notices.updateOne(
              {
                key: `${String(r._id)}:reminder:${new Date().toISOString().slice(0, 10)}:${userId}`,
              },
              {
                $setOnInsert: {
                  userId,
                  requestId: String(r._id),
                  status: 'pending',
                  attempts: 0,
                  availableAt: new Date(),
                },
              },
              { upsert: true },
            );
      }
    }
  }
}
