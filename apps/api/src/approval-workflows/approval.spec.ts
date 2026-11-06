import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Types, Model } from 'mongoose';
import { validateSync } from 'class-validator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { ApprovalWorkflowsService } from './approval.service';
import {
  ApprovalPolicy,
  ApprovalRequest,
  ApprovalNotice,
  type ApprovalLevel,
  type ApprovalStage,
} from './approval.schema';
import {
  finalApprovalLevel,
  validatePolicyLevels,
  validateStages,
  nextApprovalState,
  ensureDecisionAllowed,
} from './approval.logic';
import {
  SaveApprovalPolicyDto,
  SubmitApprovalDto,
  ApprovalDecisionDto,
} from './approval.dto';
import { Branch } from '../branches/schemas/branch.schema';
import { District } from '../districts/schemas/district.schema';
import { HierarchyUnit } from '../hierarchy/hierarchy.schema';
import { User } from '../users/schemas/user.schema';
const oid = () => new Types.ObjectId();
const requester = oid().toString(),
  reviewer = oid().toString();
const user: AuthUser = {
  sub: reviewer,
  email: 'reviewer@example.com',
  role: 'resident_pastor',
};
const stage = (level: ApprovalLevel, who = reviewer): ApprovalStage => ({
  level,
  label: level,
  reviewerIds: [who],
  reviewerNames: ['Pastor'],
});
function q<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };
}
function fixture() {
  const branch = {
    _id: oid(),
    name: 'Church',
    district: 'District',
    oversightRegion: 'National',
    areaId: oid(),
    zoneId: oid(),
    status: 'active',
  };
  const district = {
    _id: oid(),
    name: 'District',
    oversightRegion: 'National',
  };
  const units = ['area', 'zone', 'district'].map((kind) => ({
    _id:
      kind === 'area' ? branch.areaId : kind === 'zone' ? branch.zoneId : oid(),
    kind,
    pastorVisibilityEnabled: true,
    districtId: district._id,
    name: kind,
    headquartersBranchId: branch._id,
    pastorUserId: new Types.ObjectId(reviewer),
    isActive: true,
  }));
  const policy = {
    _id: oid(),
    name: 'General',
    category: 'Welfare',
    oversightRegion: 'National',
    finalLevel: 'area',
    isActive: true,
    reviewDays: 3,
    currency: 'USD',
  };
  const request: ApprovalRequest & { _id: Types.ObjectId } = {
    _id: oid(),
    branchId: branch._id,
    branchName: branch.name,
    oversightRegion: branch.oversightRegion,
    requesterId: requester,
    requesterName: 'Requester',
    policyId: policy._id,
    policyName: policy.name,
    category: policy.category,
    title: 'Request',
    details: 'Review this request please',
    documentLinks: [],
    finalLevel: 'area',
    stages: [stage('church'), stage('area')],
    currentStage: 0,
    currentReviewerIds: [reviewer],
    participantIds: [requester],
    status: 'pending',
    history: [],
    dueAt: new Date(),
    reviewDays: 3,
    revision: 0,
    notificationRevision: -1,
  };
  const requests = {
    find: jest.fn(() => q([request])),
    countDocuments: jest.fn().mockResolvedValue(1),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    findOne: jest.fn(() => q(request)),
    create: jest.fn((v) => Promise.resolve({ _id: oid(), ...v })),
    findOneAndUpdate: jest.fn(
      (
        _filter: Record<string, unknown>,
        update: {
          $set: Partial<ApprovalRequest>;
          $push: { history: { action: string } };
          $inc: { revision: number };
        },
      ) => q({ ...request, ...update.$set, revision: request.revision + 1 }),
    ),
  };
  const policies = {
    findOne: jest.fn(() => q(policy)),
    findById: jest.fn(() => q(policy)),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(() => q(policy)),
  };
  const branchModel = {
    findOne: jest.fn(() => q(branch)),
    exists: jest.fn().mockResolvedValue(true),
  };
  const districtModel = { findOne: jest.fn(() => q(district)) };
  const unitModel = {
    findOne: jest.fn((filter: { kind: string }) =>
      q(units.find((u) => u.kind === filter.kind)),
    ),
  };
  const users = {
    find: jest.fn(() =>
      q([
        {
          _id: new Types.ObjectId(reviewer),
          firstName: 'Resident',
          lastName: 'Pastor',
        },
      ]),
    ),
  };
  const scope = {
    getBranchDocumentQuery: jest.fn().mockResolvedValue({}),
    getAccessibleBranchIds: jest.fn().mockResolvedValue([String(branch._id)]),
    unitBranchQuery: jest.fn().mockResolvedValue({}),
    oversightAssignments: jest.fn().mockResolvedValue([]),
  };
  const service = new ApprovalWorkflowsService(
    policies as unknown as Model<ApprovalPolicy>,
    requests as unknown as Model<ApprovalRequest>,
    {} as Model<ApprovalNotice>,
    branchModel as unknown as Model<Branch>,
    districtModel as unknown as Model<District>,
    unitModel as unknown as Model<HierarchyUnit>,
    users as unknown as Model<User>,
    scope as unknown as AccessScopeService,
  );
  const dto = {
    branchId: String(branch._id),
    policyId: String(policy._id),
    title: 'A request',
    details: 'Detailed request for review',
  };
  return {
    service,
    branch,
    units,
    request,
    requests,
    users,
    policies,
    policy,
    branchModel,
    unitModel,
    scope,
    dto,
  };
}
describe('approval endpoints and amounts', () => {
  for (const level of [
    'church',
    'area',
    'zone',
    'district',
    'national',
  ] as const)
    it(`ends exactly at ${level}`, () => {
      const levels = [
        'church',
        'area',
        'zone',
        'district',
        'national',
      ] as const;
      const stages = levels
        .slice(0, levels.indexOf(level) + 1)
        .map((l) => stage(l));
      expect(validateStages(stages, level)).toEqual(stages);
      let state = {
        status: 'pending',
        currentStage: 0,
        currentReviewerIds: [reviewer],
      };
      while (state.status === 'pending')
        state = nextApprovalState(stages, state.currentStage);
      expect(state.currentStage).toBe(stages.length - 1);
      expect(state.status).toBe('approved');
    });
  it('does not approve an intermediate recommendation', () =>
    expect(nextApprovalState([stage('church'), stage('area')], 0).status).toBe(
      'pending',
    ));
  it('requires amount when a threshold is configured', () =>
    expect(() =>
      finalApprovalLevel({
        finalLevel: 'church',
        thresholdAmount: 100,
        aboveThresholdLevel: 'district',
      }),
    ).toThrow(BadRequestException));
  it('uses base level at exact threshold and higher level above it', () => {
    const p = {
      finalLevel: 'church' as const,
      thresholdAmount: 100,
      aboveThresholdLevel: 'district' as const,
    };
    expect(finalApprovalLevel(p, 100)).toBe('church');
    expect(finalApprovalLevel(p, 100.01)).toBe('district');
  });
  it('cannot configure a threshold that lowers approval authority', () =>
    expect(() => validatePolicyLevels('district', 100, 'area')).toThrow(
      BadRequestException,
    ));
  it('missing final level never silently completes', () =>
    expect(() => validateStages([stage('church')], 'area')).toThrow(
      BadRequestException,
    ));
  it('missing reviewer blocks submission', () =>
    expect(() =>
      validateStages([{ ...stage('area'), reviewerIds: [] }], 'area'),
    ).toThrow(BadRequestException));
});
describe('routing and scope', () => {
  for (const level of [
    'church',
    'area',
    'zone',
    'district',
    'national',
  ] as const)
    it(`resolves the complete route ending at ${level}`, async () => {
      const f = fixture();
      f.policy.finalLevel = level;
      const r = await f.service.preview({ ...user, sub: requester }, f.dto);
      expect(r.stages.at(-1)?.level).toBe(level);
      expect(r.stages.length).toBe(
        ['church', 'area', 'zone', 'district', 'national'].indexOf(level) + 1,
      );
    });
  it('skips absent intermediate levels, never a missing endpoint', async () => {
    const f = fixture();
    f.branch.areaId = undefined as unknown as Types.ObjectId;
    f.policy.finalLevel = 'zone';
    expect(
      (await f.service.preview({ ...user, sub: requester }, f.dto)).stages.map(
        (s) => s.level,
      ),
    ).toEqual(['church', 'zone']);
    f.policy.finalLevel = 'area';
    await expect(
      f.service.preview({ ...user, sub: requester }, f.dto),
    ).rejects.toThrow(BadRequestException);
  });
  it('rejects out-of-scope churches', async () => {
    const f = fixture();
    f.branchModel.findOne.mockReturnValue(q(null) as never);
    await expect(f.service.preview(user, f.dto)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('requires active reviewers', async () => {
    const f = fixture();
    f.users.find.mockReturnValue(q([]));
    await expect(f.service.preview(user, f.dto)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('excludes the requester from every reviewer lookup', async () => {
    const f = fixture();
    await f.service.preview({ ...user, sub: requester }, f.dto);
    for (const args of f.users.find.mock.calls)
      expect((args as unknown as [Record<string, unknown>])[0]).toMatchObject({
        isActive: true,
        _id: { $ne: new Types.ObjectId(requester) },
      });
  });
  it('blocks route configuration by local pastors', async () => {
    const f = fixture();
    await expect(
      f.service.savePolicy(user, {} as SaveApprovalPolicyDto),
    ).rejects.toThrow(ForbiddenException);
  });
  it('blocks national administrators outside their region', async () => {
    const f = fixture();
    await expect(
      f.service.savePolicy(
        { ...user, role: 'national_admin', oversightRegion: 'Other' },
        { oversightRegion: 'National' } as SaveApprovalPolicyDto,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
describe('decisions, concurrency and history', () => {
  it('blocks self review even when snapshot includes requester', () =>
    expect(() =>
      ensureDecisionAllowed(
        {
          status: 'pending',
          requesterId: reviewer,
          currentReviewerIds: [reviewer],
        },
        reviewer,
      ),
    ).toThrow(ForbiddenException));
  it('blocks future or unrelated reviewers', () =>
    expect(() =>
      ensureDecisionAllowed(
        {
          status: 'pending',
          requesterId: requester,
          currentReviewerIds: ['other'],
        },
        reviewer,
      ),
    ).toThrow(ForbiddenException));
  it('cannot act on a completed request', () =>
    expect(() =>
      ensureDecisionAllowed(
        {
          status: 'approved',
          requesterId: requester,
          currentReviewerIds: [reviewer],
        },
        reviewer,
      ),
    ).toThrow(BadRequestException));
  it('records recommendation then leaves request pending', async () => {
    const f = fixture();
    const r = await f.service.decide(user, String(f.request._id), {
      action: 'advance',
      note: 'Recommended',
      expectedRevision: 0,
    });
    expect(r.status).toBe('pending');
    expect(r.currentStage).toBe(1);
    const update = f.requests.findOneAndUpdate.mock.calls[0][1];
    expect(update.$push.history.action).toBe('recommended');
    expect(update.$inc.revision).toBe(1);
  });
  it('final approver completes without adding higher levels', async () => {
    const f = fixture();
    f.request.currentStage = 1;
    const r = await f.service.decide(user, String(f.request._id), {
      action: 'advance',
      note: 'Approved',
      expectedRevision: 0,
    });
    expect(r.status).toBe('approved');
    expect(r.currentReviewerIds).toEqual([]);
  });
  it('concurrent update has no second decision or history write', async () => {
    const f = fixture();
    f.requests.findOneAndUpdate.mockReturnValue(q(null) as never);
    await expect(
      f.service.decide(user, String(f.request._id), {
        action: 'advance',
        note: 'Approved',
        expectedRevision: 0,
      }),
    ).rejects.toThrow(ConflictException);
    expect(f.requests.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      revision: 0,
      status: 'pending',
    });
  });
  it('stale revision blocks review before writes', async () => {
    const f = fixture();
    await expect(
      f.service.decide(user, String(f.request._id), {
        action: 'advance',
        note: 'Approved',
        expectedRevision: 5,
      }),
    ).rejects.toThrow(ConflictException);
    expect(f.requests.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('stale appointment never grants authority', async () => {
    const f = fixture();
    f.users.find.mockReturnValue(
      q([{ _id: oid(), firstName: 'New', lastName: 'Pastor' }]),
    );
    await expect(
      f.service.decide(user, String(f.request._id), {
        action: 'advance',
        note: 'Approved',
        expectedRevision: 0,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  for (const action of ['reject', 'return'])
    it(`records ${action} and stops queue`, async () => {
      const f = fixture();
      const r = await f.service.decide(user, String(f.request._id), {
        action,
        note: 'Documented reason',
        expectedRevision: 0,
      });
      expect(r.status).toBe(action === 'reject' ? 'rejected' : 'returned');
      expect(r.currentReviewerIds).toEqual([]);
    });
  it('escalation requires final reviewer and a higher endpoint', async () => {
    const f = fixture();
    await expect(
      f.service.decide(user, String(f.request._id), {
        action: 'escalate',
        note: 'Needs review',
        expectedRevision: 0,
        targetLevel: 'district',
      }),
    ).rejects.toThrow(BadRequestException);
    f.request.currentStage = 1;
    const r = await f.service.decide(user, String(f.request._id), {
      action: 'escalate',
      note: 'Needs review',
      expectedRevision: 0,
      targetLevel: 'district',
    });
    expect(r.finalLevel).toBe('district');
    expect(r.currentStage).toBe(2);
    expect(r.status).toBe('pending');
  });
  it('requester can withdraw but not approve', async () => {
    const f = fixture();
    const r = await f.service.decide(
      { ...user, sub: requester },
      String(f.request._id),
      { action: 'withdraw', note: 'No longer needed', expectedRevision: 0 },
    );
    expect(r.status).toBe('withdrawn');
  });
  it('submit snapshots route and original supporting material', async () => {
    const f = fixture();
    const r = await f.service.submit({ ...user, sub: requester }, f.dto);
    expect(r.stages.length).toBe(2);
    expect(r.history[0]).toHaveProperty('submission');
    expect(r.status).toBe('pending');
  });
});
describe('DTO boundaries', () => {
  it('rejects non-HTTPS evidence and negative amounts', () => {
    const dto = Object.assign(new SubmitApprovalDto(), {
      branchId: oid().toString(),
      policyId: oid().toString(),
      title: 'Title',
      details: 'Enough detail here',
      amount: -1,
      documentLinks: ['javascript:alert(1)'],
    });
    expect(validateSync(dto).map((e) => e.property)).toEqual(
      expect.arrayContaining(['amount', 'documentLinks']),
    );
  });
  it('requires decision reason and revision', () =>
    expect(
      validateSync(
        Object.assign(new ApprovalDecisionDto(), {
          action: 'advance',
          note: '',
        }),
      ).map((e) => e.property),
    ).toEqual(expect.arrayContaining(['note', 'expectedRevision'])));
});

describe('queue visibility and notification recovery', () => {
  it('demoted staff do not inherit a stale reviewer assignment', async () => {
    const f = fixture();
    await f.service.list({ ...user, role: 'follow_up' }, {});
    const query = f.requests.find.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(JSON.stringify(query[0])).not.toContain('currentReviewerIds');
    expect(JSON.stringify(query[0])).toContain('participantIds');
  });
  it('review queues remain constrained by current church access', async () => {
    const f = fixture();
    await f.service.list(user, { view: 'review' });
    const query = f.requests.find.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(JSON.stringify(query[0])).toContain(String(f.branch._id));
    expect(JSON.stringify(query[0])).toContain('currentReviewerIds');
  });
  it('requesters can resubmit only returned requests and preserve submitted versions', async () => {
    const f = fixture();
    f.request.status = 'returned';
    await f.service.submit(
      { ...user, sub: requester },
      { ...f.dto, expectedRevision: 0 },
      String(f.request._id),
    );
    const update = f.requests.findOneAndUpdate.mock.calls[0][1];
    expect(update.$push.history).toHaveProperty('submission');
    expect(update.$set.currentStage).toBe(0);
    expect(update.$set.status).toBe('pending');
  });
  it('one logical notification per account per request revision despite repeated roles', async () => {
    const f = fixture();
    f.request.currentReviewerIds = [reviewer, reviewer];
    f.request.nextReminderAt = new Date(Date.now() + 86400000);
    const notices = { updateOne: jest.fn().mockResolvedValue({}) };
    Object.defineProperty(f.service, 'notices', { value: notices });
    await f.service.queueNotices();
    expect(notices.updateOne).toHaveBeenCalledTimes(2);
    const keys = notices.updateOne.mock.calls.map(
      (c) => (c as unknown as [{ key: string }])[0].key,
    );
    expect(new Set(keys).size).toBe(2);
    expect(f.requests.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 0 }),
      expect.objectContaining({ $set: { notificationRevision: 0 } }),
    );
  });
  it('overdue reminders do not alter approval status or advance the stage', async () => {
    const f = fixture();
    f.request.nextReminderAt = new Date(Date.now() - 86400000);
    Object.defineProperty(f.service, 'notices', {
      value: { updateOne: jest.fn().mockResolvedValue({}) },
    });
    await f.service.queueNotices();
    for (const call of f.requests.updateOne.mock.calls as unknown as [
      unknown,
      { $set: Record<string, unknown> },
    ][]) {
      expect(call[1].$set).not.toHaveProperty('status');
      expect(call[1].$set).not.toHaveProperty('currentStage');
    }
  });
});

it('null amounts cannot bypass amount-based route requirements', () => {
  const dto = Object.assign(new SubmitApprovalDto(), {
    branchId: oid().toString(),
    policyId: oid().toString(),
    title: 'Title',
    details: 'Enough detail here',
    amount: null,
  });
  expect(validateSync(dto).map((e) => e.property)).toContain('amount');
  expect(() =>
    finalApprovalLevel(
      {
        finalLevel: 'church',
        thresholdAmount: 100,
        aboveThresholdLevel: 'national',
      },
      null as unknown as number,
    ),
  ).toThrow(BadRequestException);
});

describe('Explicit oversight access in approval routes', () => {
  it('does not route a request to an appointed pastor without administrator-enabled access', async () => {
    const f = fixture();
    f.units[0].pastorVisibilityEnabled = false;
    await expect(f.service.preview(user, f.dto)).rejects.toThrow(
      'enable the appointed pastor',
    );
  });
  it('constrains direct request reads to the current church scope, including previous participants', async () => {
    const f = fixture();
    await f.service.detail(user, String(f.request._id));
    const filter = (
      f.requests.findOne.mock.calls[0] as unknown as [Record<string, unknown>]
    )[0];
    expect(filter.$and).toContainEqual({ branchId: { $in: [f.branch._id] } });
  });
});
