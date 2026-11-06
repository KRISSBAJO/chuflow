import { Connection, createConnection, Types } from 'mongoose';
import {
  WeeklyWorkflowService,
  WEEKLY_FIGURES,
} from './weekly-workflow.service';
import {
  IntakeSubmission,
  IntakeSubmissionSchema,
} from './schemas/intake-submission.schema';
import {
  IntakeTemplate,
  IntakeTemplateSchema,
} from './schemas/intake-template.schema';
import {
  WeeklyDistrictPacket,
  WeeklyDistrictPacketSchema,
} from './weekly-workflow.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ForbiddenException } from '@nestjs/common';

const run = process.env.CHUFLOW_RELEASE_QA === '1' ? describe : describe.skip;
run('weekly reporting release checks', () => {
  let db: Connection;
  let service: WeeklyWorkflowService;
  const branch = new Types.ObjectId();
  const missingBranch = new Types.ObjectId();
  const author = new Types.ObjectId();
  const admin = new Types.ObjectId();
  const pastor = new Types.ObjectId();
  const clerk: AuthUser = {
    sub: String(author),
    email: 'clerk@example.test',
    role: 'branch_admin',
    branchId: String(branch),
  };
  const districtAdmin: AuthUser = {
    sub: String(admin),
    email: 'admin@example.test',
    role: 'district_admin',
    district: 'QA',
    oversightRegion: 'USA',
  };
  const reviewer: AuthUser = {
    sub: String(pastor),
    email: 'pastor@example.test',
    role: 'district_pastor',
    district: 'QA',
    oversightRegion: 'USA',
  };
  const figures = Object.fromEntries(
    WEEKLY_FIGURES.map((key) => [key, key === 'currentAttendance' ? 100 : 0]),
  );
  beforeAll(async () => {
    db = await createConnection(
      'mongodb://127.0.0.1:27129/chuflow_weekly_release_tests?replicaSet=chuflow-release-qa',
    ).asPromise();
    db.model(IntakeSubmission.name, IntakeSubmissionSchema);
    db.model(IntakeTemplate.name, IntakeTemplateSchema);
    db.model(WeeklyDistrictPacket.name, WeeklyDistrictPacketSchema);
    db.model(Branch.name, BranchSchema);
    db.model(User.name, UserSchema);
    await Promise.all(Object.values(db.models).map((model) => model.init()));
  });
  beforeEach(async () => {
    await Promise.all(
      Object.values(db.models).map((model) => model.deleteMany({})),
    );
    await db.model(Branch.name).collection.insertMany([
      {
        _id: branch,
        name: 'Station A',
        district: 'QA',
        oversightRegion: 'USA',
      },
      {
        _id: missingBranch,
        name: 'Station B',
        district: 'QA',
        oversightRegion: 'USA',
      },
    ]);
    await db
      .model(User.name)
      .collection.insertOne({
        _id: pastor,
        firstName: 'District',
        lastName: 'Pastor',
        role: 'district_pastor',
        district: 'QA',
        oversightRegion: 'USA',
        email: 'pastor@example.test',
        isActive: true,
      });
    await db
      .model(IntakeTemplate.name)
      .collection.insertOne({
        name: 'Weekly',
        slug: 'weekly-spiritual-indices',
        kind: 'weekly_report',
      });
    service = Object.create(
      WeeklyWorkflowService.prototype,
    ) as WeeklyWorkflowService;
    Object.assign(service, {
      reports: db.model(IntakeSubmission.name),
      templates: db.model(IntakeTemplate.name),
      packets: db.model(WeeklyDistrictPacket.name),
      branches: db.model(Branch.name),
      users: db.model(User.name),
      audit: { record: jest.fn().mockResolvedValue(undefined) },
      push: { notifyDistrictTeam: jest.fn(), notifyUsers: jest.fn() },
      scope: {
        ensureBranchAccess: jest.fn().mockResolvedValue(undefined),
        oversightAssignments: jest.fn().mockResolvedValue([]),
        getBranchDocumentQuery: jest
          .fn()
          .mockImplementation((u: AuthUser) =>
            u.role === 'branch_admin'
              ? { _id: u.branchId }
              : u.district === 'QA'
                ? { district: 'QA' }
                : { _id: new Types.ObjectId() },
          ),
      },
    });
  });
  afterAll(async () => {
    await db.close();
  });
  const create = () =>
    service.save(clerk, {
      branchId: String(branch),
      weekEnding: '2026-11-01',
      figures,
      submit: true,
    });
  it('locks acknowledged reports against edits and preserves missing stations', async () => {
    const report = await create();
    await service.review(districtAdmin, String(report._id), {
      revision: 0,
      decision: 'approved',
    });
    await expect(
      service.save(
        clerk,
        {
          branchId: String(branch),
          weekEnding: '2026-11-01',
          figures,
          revision: 1,
        },
        String(report._id),
      ),
    ).rejects.toThrow('locked');
    const matrix = await service.list(districtAdmin, '2026-11-01');
    expect(matrix.coverage).toMatchObject({
      total: 2,
      acknowledged: 1,
      missing: 1,
    });
    expect(matrix.totals.currentAttendance).toBe(100);
    expect(matrix.totals.growthPercent).toBeNull();
  });
  it('prevents stale acknowledgement and district access outside the reviewer scope', async () => {
    const report = await create();
    await service.save(
      clerk,
      {
        branchId: String(branch),
        weekEnding: '2026-11-01',
        figures: { ...figures, currentAttendance: 200 },
        revision: 0,
        submit: true,
      },
      String(report._id),
    );
    await expect(
      service.review(districtAdmin, String(report._id), {
        revision: 0,
        decision: 'approved',
      }),
    ).rejects.toThrow('changed');
    await expect(
      service.review(
        { ...districtAdmin, district: 'Other' },
        String(report._id),
        { revision: 1, decision: 'approved' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
  it('keeps a fixed district snapshot, restricts its recipient, and permits one acknowledgement', async () => {
    const report = await create();
    await service.review(districtAdmin, String(report._id), {
      revision: 0,
      decision: 'approved',
    });
    const packet = await service.forward(districtAdmin, {
      district: 'QA',
      oversightRegion: 'USA',
      weekEnding: '2026-11-01',
      recipientId: String(pastor),
    });
    await db
      .model(IntakeSubmission.name)
      .collection.updateOne(
        { _id: report._id },
        { $set: { currentAttendance: 999 } },
      );
    const sent = await service.packetList(reviewer);
    expect(
      (sent[0].snapshot as { totals: { currentAttendance: number } }).totals
        .currentAttendance,
    ).toBe(100);
    await expect(
      service.reviewPacket(districtAdmin, String(packet._id), {
        decision: 'acknowledged',
      }),
    ).rejects.toThrow('selected recipient');
    await service.reviewPacket(reviewer, String(packet._id), {
      decision: 'acknowledged',
    });
    await expect(
      service.reviewPacket(reviewer, String(packet._id), {
        decision: 'returned',
      }),
    ).rejects.toThrow('already been reviewed');
  });
});
