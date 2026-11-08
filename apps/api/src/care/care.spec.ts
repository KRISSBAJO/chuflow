/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Jest mock call arguments are intentionally inspected below. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types, model } from 'mongoose';
import {
  careAllowed,
  contactWindow,
  normalizeCareEmail,
  retentionEvidence,
  renderCareTemplate,
} from './care.policy';
import { CareService } from './care.service';
import {
  CareCaseSchema,
  CareTaskSchema,
  CareJobSchema,
  CarePlanSchema,
  CareTokenSchema,
} from './care.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CareChangeDto, CarePlanDto } from './care.dto';
const id = () => new Types.ObjectId();
const branch = id(),
  caseId = id(),
  owner = id(),
  target = id(),
  taskId = id();
const user = (
  sub = String(owner),
  role: AuthUser['role'] = 'follow_up',
): AuthUser => ({
  sub,
  role,
  email: 'qa@example.test',
  branchId: String(branch),
});
function query<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockResolvedValue([]),
  };
}
function fixture() {
  const record = {
    _id: caseId,
    branchId: branch,
    personKey: 'guest:test',
    personType: 'guest',
    journey: 'guest_welcome',
    firstName: 'Chris',
    lastName: 'Test',
    email: 'test@example.com',
    stage: 'connecting',
    ownerId: owner,
    backupId: undefined as Types.ObjectId | undefined,
    stopContact: false,
    emailAllowed: false,
    language: 'en',
    revision: 2,
    pendingEvents: [] as Record<string, unknown>[],
    unansweredAttempts: 0,
    automationEnrolledAt: undefined as Date | undefined,
    handover: undefined as
      | { to: string; from: string; status: string; requestedAt: string }
      | undefined,
  };
  const cases = {
    findById: jest.fn(() => query(record)),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const tasks = {
    exists: jest.fn().mockResolvedValue(null),
    findOne: jest.fn(() =>
      query({
        _id: taskId,
        caseId,
        attempts: 2,
        status: 'open',
        assignedTo: owner,
      }),
    ),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    find: jest.fn(() => query([])),
  };
  const events = {
    exists: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const plans = {
    findOne: jest.fn(() =>
      query({
        enabled: true,
        maxAttempts: 3,
        retryHours: 48,
        leaderId: target,
      }),
    ),
  };
  const jobs = {
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const tokens = {
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    findOne: jest.fn(() => query({ _id: id(), caseId, kind: 'checkin' })),
    findOneAndUpdate: jest.fn(() =>
      query({ _id: id(), caseId, kind: 'checkin' }),
    ),
    create: jest.fn().mockResolvedValue({}),
  };
  const users = {
    findOne: jest.fn(() =>
      query({
        _id: target,
        branchId: branch,
        isActive: true,
        role: 'follow_up',
      }),
    ),
  };
  const guests = {};
  const members = {};
  const branches = { findById: jest.fn(() => query({ name: 'Test Church' })) };
  const outreach = {};
  const units = {
    findOne: jest.fn(() => query({ _id: id(), branchId: branch })),
  };
  const scope = {
    ensureBranchAccess: jest.fn().mockResolvedValue(undefined),
    buildBranchFilter: jest.fn().mockResolvedValue({ branchId: branch }),
  };
  const config = { get: jest.fn().mockReturnValue('https://chuflow.com') };
  const entitlements = { snapshot: jest.fn().mockResolvedValue(undefined) };
  const args = [
    cases,
    tasks,
    events,
    plans,
    jobs,
    tokens,
    users,
    guests,
    members,
    branches,
    outreach,
    units,
    scope,
    config,
    entitlements,
  ] as unknown as ConstructorParameters<typeof CareService>;
  const service = new CareService(...args);
  const flush = jest.spyOn(service, 'flush').mockResolvedValue(undefined);
  jest.spyOn(service, 'details').mockResolvedValue({});
  return {
    service,
    record,
    cases,
    tasks,
    events,
    plans,
    jobs,
    tokens,
    users,
    scope,
    flush,
    entitlements,
  };
}
describe('Care contact and retention policies', () => {
  it('normalizes email addresses and rejects malformed addresses', () => {
    expect(normalizeCareEmail(' PERSON@EXAMPLE.COM ')).toBe(
      'person@example.com',
    );
    expect(normalizeCareEmail('bad')).toBeUndefined();
    expect(normalizeCareEmail('a@b.com\nBcc: x@y.com')).toBeUndefined();
  });
  it('stops paused, opted-out, closed and merged care', () => {
    expect(careAllowed({ stopContact: true, stage: 'connecting' })).toBe(false);
    expect(careAllowed({ stopContact: false, stage: 'closed' })).toBe(false);
    expect(careAllowed({ stopContact: false, stage: 'paused' })).toBe(false);
    expect(
      careAllowed({
        stopContact: false,
        stage: 'connecting',
        mergedInto: 'other',
      }),
    ).toBe(false);
    expect(
      careAllowed({
        stopContact: false,
        stage: 'paused',
        pausedUntil: new Date(Date.now() - 1),
      }),
    ).toBe(true);
  });
  it('moves mail out of local quiet hours', () => {
    const due = contactWindow(
      new Date('2026-11-06T03:00:00Z'),
      'America/Chicago',
      20,
      8,
    );
    expect(due.toISOString()).toBe('2026-11-06T14:00:00.000Z');
    expect(
      contactWindow(
        new Date('2026-11-06T16:00:00Z'),
        'America/Chicago',
        20,
        8,
      ).toISOString(),
    ).toBe('2026-11-06T16:00:00.000Z');
  });
  it('handles daylight-saving transitions using local clock time', () => {
    const due = contactWindow(
      new Date('2026-11-01T05:00:00Z'),
      'America/Chicago',
      20,
      8,
    );
    expect(due.toISOString()).toBe('2026-11-01T14:00:00.000Z');
  });
  it('will not infer absence from summary headcounts or unconfirmed coverage', () => {
    const result = retentionEvidence(
      {
        reliable: false,
        count: 30,
        minimum: 3,
        last: new Date('2026-09-01'),
        gapDays: 21,
        paused: false,
      },
      Date.parse('2026-11-05'),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('coverage');
  });
  it('requires a minimum baseline and respects explanations / pauses', () => {
    const base = {
      reliable: true,
      coverageFrom: new Date('2026-08-01'),
      count: 2,
      minimum: 3,
      last: new Date('2026-09-01'),
      gapDays: 21,
      paused: false,
    };
    expect(retentionEvidence(base, Date.parse('2026-11-05')).eligible).toBe(
      false,
    );
    expect(
      retentionEvidence(
        { ...base, count: 3, paused: true },
        Date.parse('2026-11-05'),
      ).eligible,
    ).toBe(false);
    expect(
      retentionEvidence({ ...base, count: 3 }, Date.parse('2026-11-05'))
        .eligible,
    ).toBe(true);
  });
  it('does not invent unavailable template variables', () => {
    expect(
      renderCareTemplate('Hi {{firstName}} at {{churchName}}: {{checkInUrl}}', {
        firstName: 'Chris',
        churchName: 'Test Church',
        checkInUrl: 'https://example.test',
      }),
    ).toBe('Hi Chris at Test Church: https://example.test');
  });
});
describe('Care case permissions and reliable state changes', () => {
  it('checks branch access before any change', async () => {
    const f = fixture();
    f.scope.ensureBranchAccess.mockRejectedValue(new ForbiddenException());
    await expect(
      f.service.change(user(), String(caseId), {
        operation: 'note',
        note: 'Hello',
        expectedRevision: 2,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(f.cases.updateOne).not.toHaveBeenCalled();
  });
  it('denies unrelated care workers even in the same branch', async () => {
    const f = fixture();
    await expect(
      f.service.context(user(String(target)), String(caseId)),
    ).rejects.toThrow(ForbiddenException);
  });
  it('permits a pending handover recipient to read but not edit the case', async () => {
    const f = fixture();
    f.record.handover = {
      to: String(target),
      from: String(owner),
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    await expect(
      f.service.context(user(String(target)), String(caseId)),
    ).resolves.toBeDefined();
    await expect(
      f.service.change(user(String(target)), String(caseId), {
        operation: 'note',
        note: 'unauthorised edit',
        expectedRevision: 2,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('transfers ownership only when the receiving worker accepts', async () => {
    const f = fixture();
    f.record.handover = {
      to: String(target),
      from: String(owner),
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    await f.service.change(user(String(target)), String(caseId), {
      operation: 'accept',
      expectedRevision: 2,
    });
    expect(f.cases.updateOne.mock.calls[0][1].$set.ownerId).toEqual(target);
    expect(
      f.cases.updateOne.mock.calls[0][1].$push.pendingEvents.data.effects
        .reassignTasks,
    ).toEqual({ from: String(owner), to: String(target) });
  });
  it('stores timeline intent atomically with the expected revision', async () => {
    const f = fixture();
    await f.service.change(user(), String(caseId), {
      operation: 'note',
      note: 'Promised a call tomorrow.',
      expectedRevision: 2,
    });
    expect(f.cases.updateOne.mock.calls[0][0]).toEqual({
      _id: caseId,
      revision: 2,
    });
    expect(
      f.cases.updateOne.mock.calls[0][1].$push.pendingEvents,
    ).toMatchObject({
      text: 'Promised a call tomorrow.',
      actorId: String(owner),
      kind: 'note',
    });
  });
  it('rejects stale saves without applying task or message effects', async () => {
    const f = fixture();
    f.cases.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(
      f.service.change(user(), String(caseId), {
        operation: 'note',
        note: 'Stale edit',
        expectedRevision: 1,
      }),
    ).rejects.toThrow(ConflictException);
    expect(f.flush).not.toHaveBeenCalled();
  });
  it('restricts pastoral notes to leadership', async () => {
    const f = fixture();
    await expect(
      f.service.change(user(), String(caseId), {
        operation: 'note',
        note: 'Restricted',
        visibility: 'pastoral',
        expectedRevision: 2,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('cancels queued messages and contact tasks when contact is stopped', async () => {
    const f = fixture();
    await f.service.change(user(), String(caseId), {
      operation: 'preferences',
      stopContact: true,
      emailAllowed: false,
      expectedRevision: 2,
    });
    expect(f.cases.updateOne.mock.calls[0][1].$set).toMatchObject({
      stopContact: true,
      stage: 'closed',
      emailAllowed: false,
    });
    expect(
      f.cases.updateOne.mock.calls[0][1].$push.pendingEvents.data.effects,
    ).toMatchObject({ cancelEmails: true, cancelTasks: true });
  });
  it('requires evidence before enabling email permission', async () => {
    const f = fixture();
    await expect(
      f.service.change(user(), String(caseId), {
        operation: 'preferences',
        emailAllowed: true,
        expectedRevision: 2,
      }),
    ).rejects.toThrow('how and when');
  });
  it('does not allow an opted-out person to be enrolled or contacted', async () => {
    const f = fixture();
    f.record.stopContact = true;
    await expect(
      f.service.change(user(), String(caseId), {
        operation: 'contact',
        note: 'Calling',
        outcome: 'contacted',
        expectedRevision: 2,
      }),
    ).rejects.toThrow('Contact is stopped');
  });
  it('escalates a repeated no-answer outcome without fabricating successful contact', async () => {
    const f = fixture();
    await f.service.change(user(), String(caseId), {
      operation: 'contact',
      taskId: String(taskId),
      note: 'No answer again.',
      outcome: 'no_answer',
      expectedRevision: 2,
    });
    const update = f.cases.updateOne.mock.calls[0][1];
    expect(update.$set.lastContactAt).toBeUndefined();
    expect(update.$push.pendingEvents.data.effects.newTask).toMatchObject({
      kind: 'escalation',
      escalated: true,
      assignedTo: target,
    });
    expect(update.$push.pendingEvents.data.effects.cancelEmails).toBe(true);
  });
  it('does not change cohort registration dates when enrolling existing people', async () => {
    const f = fixture();
    await f.service.change(user(), String(caseId), {
      operation: 'enroll',
      expectedRevision: 2,
    });
    const update = f.cases.updateOne.mock.calls[0][1];
    expect(update.$set.enrollmentRequestedAt).toBeInstanceOf(Date);
    expect(update.$set.sourceCreatedAt).toBeUndefined();
  });
  it('keeps append and task effects idempotent across a retry', async () => {
    const f = fixture();
    const intent = {
      key: 'intent-1',
      kind: 'note',
      text: 'A next step',
      visibility: 'team',
      data: {
        effects: {
          newTask: {
            key: 'manual-1',
            title: 'Call',
            kind: 'care_action',
            dueAt: new Date(),
          },
        },
      },
    };
    const c = { ...f.record, pendingEvents: [intent] };
    await CareService.prototype.flush.call(
      f.service,
      c as unknown as Parameters<CareService['flush']>[0],
    );
    await CareService.prototype.flush.call(
      f.service,
      c as unknown as Parameters<CareService['flush']>[0],
    );
    expect(f.tasks.updateOne.mock.calls[0][0]).toEqual({
      caseId,
      key: 'manual-1',
    });
    expect(f.tasks.updateOne.mock.calls[1][0]).toEqual({
      caseId,
      key: 'manual-1',
    });
    expect(f.events.updateOne.mock.calls[0][0]).toEqual({ key: 'intent-1' });
  });
});
describe('Private member check-in links', () => {
  const token = 'a'.repeat(64);
  it('blocks check-ins under a lock without consuming their links and allows dedicated opt-outs', async () => {
    const f = fixture();
    f.entitlements.snapshot.mockResolvedValue({ enforced: true, access: 'locked' });
    const reply = { response: 'well', contactRequested: false, language: 'en' };
    await expect(f.service.publicInfo(token)).rejects.toMatchObject({ status: 402 });
    await expect(f.service.publicReply(token, reply)).rejects.toMatchObject({ status: 402 });
    expect(f.tokens.findOneAndUpdate).not.toHaveBeenCalled();
    f.tokens.findOne.mockReturnValue(query({ _id: id(), caseId, kind: 'unsubscribe' }));
    f.tokens.findOneAndUpdate.mockReturnValue(query({ _id: id(), caseId, kind: 'unsubscribe' }));
    await expect(f.service.publicReply(token, reply)).resolves.toEqual({ success: true });
    expect(f.cases.updateOne.mock.calls[0][1].$set).toMatchObject({ stopContact: true, emailAllowed: false });
  });
  it('retains a submitted reply for recovery when applying it is interrupted', async () => {
    const f = fixture();
    jest
      .spyOn(f.service, 'applyPublicReply')
      .mockRejectedValue(new Error('Database interrupted'));
    const reply = { response: 'well', contactRequested: false, language: 'en' };
    await expect(f.service.publicReply(token, reply)).resolves.toEqual({
      success: true,
      pending: true,
    });
    const saved = f.tokens.findOneAndUpdate.mock.calls[0][1].$set;
    expect(saved.payload).toEqual(reply);
    expect(+saved.expiresAt).toBeGreaterThan(Date.now() + 89 * 86400000);
  });
  it('stores only a token hash and an expiry', async () => {
    const f = fixture();
    await f.service.issueToken(
      f.record as unknown as Parameters<CareService['issueToken']>[0],
    );
    const data = f.tokens.create.mock.calls[0][0];
    expect(data.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.expiresAt).toBeInstanceOf(Date);
    expect(data.token).toBeUndefined();
  });
  it('does not change contact state on GET, so mail scanners cannot opt people out', async () => {
    const f = fixture();
    await expect(f.service.publicInfo(token)).resolves.toEqual({
      churchName: 'Test Church',
      kind: 'checkin',
    });
    expect(f.cases.updateOne).not.toHaveBeenCalled();
    expect(f.tokens.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects expired or unknown tokens without exposing a person record', async () => {
    const f = fixture();
    f.tokens.findOne.mockReturnValue(
      query(null) as ReturnType<typeof f.tokens.findOne>,
    );
    await expect(f.service.publicInfo(token)).rejects.toThrow(
      NotFoundException,
    );
  });
  it('validates availability before consuming a single-use link', async () => {
    const f = fixture();
    await expect(
      f.service.publicReply(token, {
        response: 'away',
        contactRequested: false,
        language: 'en',
        until: '2000-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(f.tokens.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('restricts prayer requests and creates a response task only when requested', async () => {
    const f = fixture();
    await f.service.publicReply(token, {
      response: 'prayer',
      contactRequested: true,
      language: 'en',
      note: 'Please pray for my family.',
    });
    const intent = f.cases.updateOne.mock.calls[0][1].$push.pendingEvents;
    expect(intent.visibility).toBe('pastoral');
    expect(intent.data.effects.newTask.kind).toBe('pastoral_request');
  });
  it('does not treat a normal check-in as an opt-out or attendance', async () => {
    const f = fixture();
    await f.service.publicReply(token, {
      response: 'well',
      contactRequested: false,
      language: 'en',
    });
    const update = f.cases.updateOne.mock.calls[0][1];
    expect(update.$set.stopContact).not.toBe(true);
    expect(update.$set.lastAttendanceAt).toBeUndefined();
    expect(update.$push.pendingEvents.data.effects.newTask).toBeUndefined();
  });
  it('stops contact only after an explicit opt-out POST', async () => {
    const f = fixture();
    await f.service.publicReply(token, {
      response: 'other',
      contactRequested: false,
      stopContact: true,
      language: 'en',
    });
    expect(f.cases.updateOne.mock.calls[0][1].$set).toMatchObject({
      stopContact: true,
      emailAllowed: false,
      stage: 'closed',
    });
  });
});
describe('Care schema and input invariants', () => {
  it('starts automation and email disabled by default', () => {
    const Plan = model('CarePlanPolicyTest', CarePlanSchema);
    expect(new Plan({ branchId: branch }).toObject()).toMatchObject({
      enabled: false,
      emailEnabled: false,
      attendanceReliable: false,
      firstContactHours: 24,
      maxAttempts: 3,
    });
  });
  it('enforces one case per identity, one task per step, and one job per key', () => {
    expect(
      CareCaseSchema.indexes().some(
        ([keys, options]) =>
          keys.branchId === 1 && keys.personKey === 1 && options.unique,
      ),
    ).toBe(true);
    expect(
      CareTaskSchema.indexes().some(
        ([keys, options]) =>
          keys.caseId === 1 && keys.key === 1 && options.unique,
      ),
    ).toBe(true);
    expect(
      CareJobSchema.indexes().some(
        ([keys, options]) => keys.key === 1 && options.unique,
      ),
    ).toBe(true);
    expect(
      CareTokenSchema.indexes().some(
        ([keys, options]) => keys.hash === 1 && options.unique,
      ),
    ).toBe(true);
  });
  it('rejects unsupported actions and invalid revision values', async () => {
    expect(
      (
        await validate(
          plainToInstance(CareChangeDto, {
            operation: 'send-everything',
            expectedRevision: -1,
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(CarePlanDto, { enabled: true }))).length,
    ).toBeGreaterThan(0);
  });
});
