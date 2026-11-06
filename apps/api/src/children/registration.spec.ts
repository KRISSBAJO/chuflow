import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  ChildrenRegistrationService,
  validateParentSubmission,
  registrationUuid,
} from './registration.service';
import {
  ChildrenRegistration,
  ChildrenRegistrationLink,
} from './registration.schema';
import {
  ParentRegistrationDto,
  RegistrationReviewDto,
} from './registration.dto';
import { ChildrenService } from './children.service';
import { ChildFamily } from './children.schema';
import { Branch } from '../branches/schemas/branch.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
const oid = () => new Types.ObjectId();
const query = <T>(value: T) => ({
  lean: jest.fn().mockResolvedValue(value),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
});
const payload = (): ParentRegistrationDto => ({
  requestKey: randomUUID(),
  familyName: 'Sample family',
  adults: [
    {
      firstName: 'Parent',
      lastName: 'Example',
      phone: '6155550100',
      relationship: 'Parent',
    },
  ],
  children: [
    {
      firstName: 'Little',
      lastName: 'Example',
      birthDate: '2022-01-01',
      pickupAdults: [0],
      careNotes: 'PRIVATE CARE',
    },
  ],
  consent: true,
});
function fixture() {
  const d = payload(),
    branchId = oid(),
    familyId = oid();
  const row: ChildrenRegistration & { _id: Types.ObjectId } = {
    _id: oid(),
    branchId,
    requestKey: d.requestKey,
    familyName: d.familyName,
    adults: d.adults,
    children: d.children,
    consentAt: new Date(),
    consentVersion: 'parent-registration-v1',
    status: 'pending',
    revision: 0,
    approvalStarted: false,
  };
  const u: AuthUser = {
    sub: String(oid()),
    role: 'children_supervisor',
    email: 'supervisor@example.com',
    branchId: String(branchId),
  };
  const links = {
    findOne: jest.fn(() => query({ _id: oid(), branchId, isActive: true })),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const registrations = {
    findById: jest.fn(() => query({ ...row })),
    findOne: jest.fn(() => query(null)),
    countDocuments: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue(row),
    findOneAndUpdate: jest.fn(
      (
        filter: Record<string, unknown>,
        update: { $set: Partial<ChildrenRegistration> },
      ) => {
        if (filter.status !== row.status || filter.revision !== row.revision)
          return query(null);
        Object.assign(row, update.$set);
        row.revision++;
        return query({ ...row });
      },
    ),
    updateOne: jest.fn(
      (
        filter: Record<string, unknown>,
        update: { $set: Partial<ChildrenRegistration> },
      ) => {
        if (filter.revision !== row.revision || filter.status !== row.status)
          return Promise.resolve({ modifiedCount: 0 });
        Object.assign(row, update.$set);
        row.revision++;
        return Promise.resolve({ modifiedCount: 1 });
      },
    ),
  };
  const families = { find: jest.fn(() => query([] as unknown[])) };
  const branches = {
    exists: jest.fn().mockResolvedValue(true),
    findById: jest.fn(() => query({ name: 'Church' })),
  };
  const ministry = {
    registrationAccess: jest.fn().mockResolvedValue({}),
    saveFamily: jest.fn().mockResolvedValue({ _id: familyId }),
    saveChild: jest.fn().mockResolvedValue({}),
    family: jest.fn().mockResolvedValue({ _id: familyId, branchId }),
  };
  const s = new ChildrenRegistrationService(
    links as unknown as Model<ChildrenRegistrationLink>,
    registrations as unknown as Model<ChildrenRegistration>,
    families as unknown as Model<ChildFamily>,
    branches as unknown as Model<Branch>,
    ministry as unknown as ChildrenService,
  );
  const decision: RegistrationReviewDto = {
    action: 'approve',
    expectedRevision: 0,
    note: 'Guardian and pickup adults verified.',
    guardianVerified: true,
    duplicatesChecked: true,
    registerAsMembers: false,
  };
  return {
    s,
    d,
    row,
    u,
    decision,
    links,
    registrations,
    families,
    branches,
    ministry,
    familyId,
  };
}
describe('public children registration', () => {
  it('submission creates only a pending intake, never active child or family records', async () => {
    const f = fixture();
    expect(await f.s.submit('a'.repeat(43), f.d)).toEqual({ received: true });
    expect(f.registrations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        consentAt: expect.any(Date) as unknown,
        requestKey: f.d.requestKey,
      }),
    );
    expect(f.ministry.saveFamily).not.toHaveBeenCalled();
    expect(f.ministry.saveChild).not.toHaveBeenCalled();
  });
  it('the public response reveals no child data, duplicate status or staff identity', async () => {
    const f = fixture();
    const r = await f.s.submit('a'.repeat(43), f.d);
    expect(Object.keys(r)).toEqual(['received']);
    expect(await f.s.publicInfo('a'.repeat(43))).toEqual({
      churchName: 'Church',
    });
  });
  it('retries use the same intake key without another submission', async () => {
    const f = fixture();
    f.registrations.findOne.mockReturnValue(query(f.row) as never);
    await f.s.submit('a'.repeat(43), f.d);
    expect(f.registrations.create).not.toHaveBeenCalled();
  });
  it('disabled or unknown links fail without accepting child data', async () => {
    const f = fixture();
    f.links.findOne.mockReturnValue(query(null) as never);
    await expect(f.s.submit('a'.repeat(43), f.d)).rejects.toThrow(
      NotFoundException,
    );
    expect(f.registrations.create).not.toHaveBeenCalled();
  });
  it('requires explicit guardian permission', () => {
    const d = payload();
    d.consent = false;
    expect(() => validateParentSubmission(d)).toThrow(BadRequestException);
  });
  it('pickup adults must refer to a submitted adult, with no duplicate choices', () => {
    const d = payload();
    d.children[0].pickupAdults = [2];
    expect(() => validateParentSubmission(d)).toThrow(BadRequestException);
    d.children[0].pickupAdults = [0, 0];
    expect(() => validateParentSubmission(d)).toThrow(BadRequestException);
  });
  it('rejects impossible dates and adult-age registrations', () => {
    const d = payload();
    d.children[0].birthDate = '2026-02-31';
    expect(() => validateParentSubmission(d)).toThrow(BadRequestException);
    d.children[0].birthDate = '1990-01-01';
    expect(() => validateParentSubmission(d)).toThrow(BadRequestException);
  });
  it('parents cannot submit staff approval or member-status fields', () => {
    const d = plainToInstance(ParentRegistrationDto, {
      ...payload(),
      status: 'approved',
      registerAsMembers: true,
    });
    expect(
      validateSync(d, { whitelist: true, forbidNonWhitelisted: true }).map(
        (e) => e.property,
      ),
    ).toEqual(expect.arrayContaining(['status', 'registerAsMembers']));
  });
  it('database-backed request limiting blocks excess attempts', async () => {
    const f = fixture();
    f.links.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(f.s.submit('a'.repeat(43), f.d)).rejects.toThrow(
      BadRequestException,
    );
  });
});
describe('supervisor review and recovery', () => {
  it('requires guardian verification and duplicate checks', async () => {
    const f = fixture();
    await expect(
      f.s.review(f.u, String(f.row._id), {
        ...f.decision,
        guardianVerified: false,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(f.ministry.saveFamily).not.toHaveBeenCalled();
  });
  it('unassigned workers cannot read submissions', async () => {
    const f = fixture();
    f.ministry.registrationAccess.mockRejectedValue(new ForbiddenException());
    await expect(
      f.s.detail({ ...f.u, role: 'children_worker' }, String(f.row._id)),
    ).rejects.toThrow(ForbiddenException);
  });
  it('approval links children to deterministic guardian IDs and defaults to visiting children', async () => {
    const f = fixture();
    await f.s.review(f.u, String(f.row._id), f.decision);
    expect(f.row.status).toBe('approved');
    expect(f.ministry.saveChild).toHaveBeenCalledWith(
      f.u,
      expect.objectContaining({
        familyId: String(f.familyId),
        isMember: false,
        pickupGuardianIds: [registrationUuid(f.d.requestKey + ':adult:0')],
      }),
    );
  });
  it('rejecting never creates active records', async () => {
    const f = fixture();
    await f.s.review(f.u, String(f.row._id), {
      ...f.decision,
      action: 'reject',
      guardianVerified: false,
      duplicatesChecked: false,
    });
    expect(f.row.status).toBe('rejected');
    expect(f.ministry.saveFamily).not.toHaveBeenCalled();
  });
  it('simultaneous reviews accept only one revision', async () => {
    const f = fixture();
    const result = await Promise.allSettled([
      f.s.review(f.u, String(f.row._id), f.decision),
      f.s.review(f.u, String(f.row._id), f.decision),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.ministry.saveFamily).toHaveBeenCalledTimes(1);
  });
  it('stale decisions make no changes', async () => {
    const f = fixture();
    await expect(
      f.s.review(f.u, String(f.row._id), {
        ...f.decision,
        expectedRevision: 9,
      }),
    ).rejects.toThrow(ConflictException);
    expect(f.ministry.saveFamily).not.toHaveBeenCalled();
  });
  it('partial failures retain approval intent and can resume with stable record keys', async () => {
    const f = fixture();
    f.ministry.saveChild.mockRejectedValueOnce(
      new Error('Temporary database failure'),
    );
    await expect(
      f.s.review(f.u, String(f.row._id), f.decision),
    ).rejects.toThrow();
    expect(f.row.status).toBe('pending');
    expect(f.row.approvalStarted).toBe(true);
    await f.s.review(f.u, String(f.row._id), {
      ...f.decision,
      expectedRevision: f.row.revision,
    });
    expect(f.row.status).toBe('approved');
    const calls = f.ministry.saveFamily.mock.calls as unknown as [
      unknown,
      { registrationKey: string },
    ][];
    expect(calls[0][1].registrationKey).toBe(calls[1][1].registrationKey);
  });
  it('an interrupted approval cannot be changed into a rejection after records begin creation', async () => {
    const f = fixture();
    f.row.approvalStarted = true;
    f.row.approvalAsMembers = false;
    await expect(
      f.s.review(f.u, String(f.row._id), { ...f.decision, action: 'reject' }),
    ).rejects.toThrow(ConflictException);
  });
  it('handling an existing family does not overwrite its guardians or create children', async () => {
    const f = fixture();
    await f.s.review(f.u, String(f.row._id), {
      ...f.decision,
      action: 'handled',
      existingFamilyId: String(f.familyId),
    });
    expect(f.row.status).toBe('handled');
    expect(f.ministry.saveFamily).not.toHaveBeenCalled();
    expect(f.ministry.saveChild).not.toHaveBeenCalled();
  });
  it('possible duplicates require explicit separate-family confirmation', async () => {
    const f = fixture();
    f.families.find.mockReturnValue(
      query([
        {
          _id: oid(),
          name: 'Existing family',
          requestKey: randomUUID(),
          guardians: [{ phone: '+1 (615) 555-0100' }],
        },
      ]) as never,
    );
    await expect(
      f.s.review(f.u, String(f.row._id), f.decision),
    ).rejects.toThrow(BadRequestException);
  });
});
