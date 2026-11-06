/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await -- In-memory asynchronous model mocks replace MongoDB and mail. */
import { Types } from 'mongoose';
import { CareWorker } from './care.worker';
import type { CarePlan } from './care.schema';
const id = () => new Types.ObjectId();
const branch = id(),
  caseId = id(),
  guestId = id();
function q<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };
}
function fixture() {
  const person = {
    _id: caseId,
    branchId: branch,
    guestId,
    journey: 'guest_welcome',
    stage: 'connecting',
    firstName: 'Chris',
    lastName: 'Test',
    email: 'chris@example.com',
    emailAllowed: true,
    stopContact: false,
    automatedAttempts: 0,
    lastContactAt: undefined as Date | undefined,
    lastReturnAt: undefined as Date | undefined,
    outreachId: undefined as Types.ObjectId | undefined,
    memberId: undefined as Types.ObjectId | undefined,
  };
  const plan = {
    enabled: true,
    emailEnabled: true,
    maxAutomatedMessages: 3,
    timeZone: 'America/Chicago',
    quietStart: 0,
    quietEnd: 0,
    subject: 'Hello {{firstName}}',
    message: 'Hello {{firstName}} — {{checkInUrl}}',
    subjectEs: 'Hola {{firstName}}',
    messageEs: 'Hola {{firstName}} — {{checkInUrl}}',
  };
  const job = {
    _id: id(),
    branchId: branch,
    caseId,
    kind: 'care_email',
    key: 'care-email:example',
    dueAt: new Date(Date.now() - 1000),
    createdAt: new Date(Date.now() - 1000),
    status: 'queued',
    claimedAt: undefined as Date | undefined,
    data: {
      journey: 'guest_welcome',
      email: person.email,
      budgetReserved: false,
    },
    result: '',
  };
  const jobs = {
    updateMany: jest.fn(async () => {
      if (
        job.status === 'sending' &&
        job.claimedAt &&
        +job.claimedAt < Date.now() - 5 * 60000
      )
        job.status = 'uncertain';
    }),
    findOneAndUpdate: jest.fn(
      (
        _filter: unknown,
        update: { $set: { status: string; claimedAt: Date } },
      ) => {
        const available = job.status === 'queued' && +job.dueAt <= Date.now();
        if (available) Object.assign(job, update.$set);
        return q(available ? job : null);
      },
    ),
    updateOne: jest.fn(
      async (_filter: unknown, update: { $set: Record<string, unknown> }) => {
        for (const [key, value] of Object.entries(update.$set || {}))
          if (key === 'data.budgetReserved')
            job.data.budgetReserved = Boolean(value);
          else Object.assign(job, { [key]: value });
        return { modifiedCount: 1 };
      },
    ),
    exists: jest.fn().mockResolvedValue(null),
  };
  const cases = {
    findById: jest.fn(() => q(person)),
    updateOne: jest.fn(async () => {
      if (
        person.automatedAttempts >= plan.maxAutomatedMessages ||
        person.stopContact ||
        !person.emailAllowed
      )
        return { modifiedCount: 0 };
      person.automatedAttempts++;
      return { modifiedCount: 1 };
    }),
  };
  const guest = {
    email: person.email,
    convertedToMember: false,
    branchId: branch,
  };
  const outreach = {
    branchId: branch,
    consentToContact: true,
    stage: 'new',
    email: person.email,
  };
  const care = {
    tokens: {
      find: jest.fn(() => q([])),
      exists: jest.fn().mockResolvedValue(null),
    },
    jobs,
    cases,
    plans: { findOne: jest.fn(() => q(plan)) },
    guests: { findById: jest.fn(() => q(guest)) },
    members: {
      findById: jest.fn(() => q({ email: person.email, branchId: branch })),
    },
    outreach: { findById: jest.fn(() => q(outreach)) },
    branches: { findById: jest.fn(() => q({ name: 'Test Church' })) },
    events: { updateOne: jest.fn().mockResolvedValue({}) },
    issueToken: jest
      .fn()
      .mockResolvedValue('https://example.test/private-check-in'),
  };
  const state = {
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const communications = { exists: jest.fn().mockResolvedValue(null) };
  const mail = {
    sendAppEmail: jest
      .fn()
      .mockResolvedValue({ delivered: true, messageId: 'smtp-1' }),
  };
  const push = { notifyUsers: jest.fn() };
  const make = () =>
    new CareWorker(
      ...([
        care,
        state,
        {},
        {},
        {},
        communications,
        mail,
        push,
      ] as unknown as ConstructorParameters<typeof CareWorker>),
    );
  const dispatch = (worker: CareWorker) =>
    (worker as unknown as { dispatch: () => Promise<void> }).dispatch();
  return {
    person,
    plan,
    job,
    jobs,
    cases,
    care,
    guest,
    outreach,
    state,
    communications,
    mail,
    push,
    make,
    dispatch,
  };
}
describe('Care message queue safeguards', () => {
  it('blocks a saved opt-out even while its case update is awaiting recovery', async () => {
    const f = fixture();
    f.care.tokens.exists.mockResolvedValue({ _id: id() });
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
    expect(f.person.automatedAttempts).toBe(0);
  });
  it('keeps email off when the branch plan is disabled', async () => {
    const f = fixture();
    f.plan.enabled = false;
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
    expect(f.job.status).toBe('cancelled');
  });
  it('requires both branch email enablement and personal permission', async () => {
    const f = fixture();
    f.person.emailAllowed = false;
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
    expect(f.person.automatedAttempts).toBe(0);
  });
  it('does not send to a person who has stopped contact', async () => {
    const f = fixture();
    f.person.stopContact = true;
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
  });
  it('rechecks evangelism opt-out immediately before sending', async () => {
    const f = fixture();
    f.person.outreachId = id();
    f.outreach.stage = 'do_not_contact';
    f.outreach.consentToContact = false;
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
  });
  it('cancels obsolete guest messages after membership conversion', async () => {
    const f = fixture();
    f.guest.convertedToMember = true;
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
  });
  it('suppresses automation after recorded personal contact or a return visit', async () => {
    const f = fixture();
    f.person.lastContactAt = new Date();
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
  });
  it('rechecks the current address instead of sending to a stale snapshot', async () => {
    const f = fixture();
    f.guest.email = 'new@example.com';
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
  });
  it('does not send when the underlying person record has been removed', async () => {
    const f = fixture();
    f.care.guests.findById.mockReturnValue(
      q(null) as ReturnType<typeof f.care.guests.findById>,
    );
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
  });
  it('does not compete with a recent communication logged by another team', async () => {
    const f = fixture();
    f.communications.exists.mockResolvedValue({ _id: id() });
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
  });
  it('does not send another automated message inside the frequency window', async () => {
    const f = fixture();
    f.jobs.exists.mockResolvedValue({ _id: id() });
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
  });
  it('reschedules quiet-hour work without spending the contact budget', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-06T03:00:00Z'));
    try {
      const f = fixture();
      f.plan.quietStart = 20;
      f.plan.quietEnd = 8;
      await f.dispatch(f.make());
      expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
      expect(f.job.status).toBe('queued');
      expect(f.job.dueAt.toISOString()).toBe('2026-11-06T14:00:00.000Z');
      expect(f.person.automatedAttempts).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
  it('claims a queued message once across two worker instances', async () => {
    const f = fixture();
    await Promise.all([f.dispatch(f.make()), f.dispatch(f.make())]);
    expect(f.mail.sendAppEmail).toHaveBeenCalledTimes(1);
    expect(f.job.status).toBe('sent');
    expect(f.mail.sendAppEmail.mock.calls[0][0]).toMatchObject({
      to: 'chris@example.com',
      subject: 'Hello Chris',
      text: expect.stringContaining('Stop these messages:'),
    });
  });
  it('enforces the automatic attempt cap', async () => {
    const f = fixture();
    f.person.automatedAttempts = 3;
    await f.dispatch(f.make());
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
    expect(f.job.result).toContain('limit');
  });
  it('records missing SMTP as failed and reuses its reserved budget on an explicit retry', async () => {
    const f = fixture();
    f.mail.sendAppEmail.mockResolvedValue({
      delivered: false,
      messageId: null,
    });
    await f.dispatch(f.make());
    expect(f.job.status).toBe('failed');
    expect(f.person.automatedAttempts).toBe(1);
    f.job.status = 'queued';
    f.mail.sendAppEmail.mockResolvedValue({
      delivered: true,
      messageId: 'smtp-2',
    });
    await f.dispatch(f.make());
    expect(f.person.automatedAttempts).toBe(1);
    expect(f.job.status).toBe('sent');
  });
  it('never automatically retries an ambiguous send', async () => {
    const f = fixture();
    f.mail.sendAppEmail.mockRejectedValue(new Error('Connection interrupted'));
    await f.dispatch(f.make());
    await f.dispatch(f.make());
    expect(f.job.status).toBe('uncertain');
    expect(f.mail.sendAppEmail).toHaveBeenCalledTimes(1);
  });
  it('treats interrupted sending work as uncertain rather than replaying it', async () => {
    const f = fixture();
    f.job.status = 'sending';
    f.job.claimedAt = new Date(Date.now() - 10 * 60000);
    await f.dispatch(f.make());
    expect(f.job.status).toBe('uncertain');
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
  });
  it('does not confuse provider acceptance with a personal conversation', async () => {
    const f = fixture();
    await f.dispatch(f.make());
    expect(f.person.lastContactAt).toBeUndefined();
    expect(f.person.lastReturnAt).toBeUndefined();
  });
});

describe('Recoverable care enrollment', () => {
  it('finishes interrupted setup using its original enrollment date', async () => {
    const f = fixture();
    const startedAt = new Date('2026-11-05T12:00:00Z');
    const person = {
      ...f.person,
      automationEnrolledAt: startedAt,
      ownerId: id(),
      revision: 2,
    };
    const cases = {
      find: jest.fn(() => q([person])),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const tasks = {
      exists: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({ upsertedCount: 1 }),
    };
    const jobs = {
      updateOne: jest
        .fn()
        .mockRejectedValueOnce(new Error('Queue interrupted'))
        .mockResolvedValue({}),
    };
    const care = { ...f.care, cases, tasks, jobs };
    const worker = new CareWorker(
      ...([
        care,
        f.state,
        {},
        {},
        {},
        f.communications,
        f.mail,
        f.push,
      ] as unknown as ConstructorParameters<typeof CareWorker>),
    );
    const enroll = (plan: CarePlan) =>
      (
        worker as unknown as { enroll: (plan: CarePlan) => Promise<void> }
      ).enroll(plan);
    const plan = {
      ...f.plan,
      branchId: branch,
      firstContactHours: 24,
    } as CarePlan;
    await expect(enroll(plan)).rejects.toThrow('Queue interrupted');
    expect(
      cases.updateOne.mock.calls.some(
        (call) => call[1].$set.enrollmentCompletedAt,
      ),
    ).toBe(false);
    await enroll(plan);
    expect(
      cases.updateOne.mock.calls.at(-1)?.[1].$set.enrollmentCompletedAt,
    ).toBeInstanceOf(Date);
    expect(jobs.updateOne.mock.calls[0][0]).toEqual(
      jobs.updateOne.mock.calls[1][0],
    );
    expect(tasks.updateOne.mock.calls[0][1].$setOnInsert.dueAt).toEqual(
      new Date('2026-11-06T12:00:00Z'),
    );
  });
});

describe('Imported care sources', () => {
  it('does not treat migrated people as newly registered for automatic enrollment', async () => {
    const f = fixture();
    const cases = {
      findOneAndUpdate: jest.fn(
        (
          _filter: unknown,
          _update: { $setOnInsert: { sourceCreatedAt: unknown } },
          _options: unknown,
        ) => q(null),
      ),
    };
    const worker = new CareWorker(
      ...([
        { ...f.care, cases },
        f.state,
        {},
        {},
        {},
        f.communications,
        f.mail,
        f.push,
      ] as unknown as ConstructorParameters<typeof CareWorker>),
    );
    const ensure = (source: Record<string, unknown>) =>
      (
        worker as unknown as {
          ensure: (
            source: Record<string, unknown>,
            type: string,
          ) => Promise<unknown>;
        }
      ).ensure(source, 'guest');
    const createdAt = new Date();
    await ensure({
      _id: guestId,
      branchId: branch,
      importBatchId: id(),
      createdAt,
    });
    expect(
      cases.findOneAndUpdate.mock.calls[0]?.[1].$setOnInsert.sourceCreatedAt,
    ).toBeNull();
    await ensure({ _id: guestId, branchId: branch, createdAt });
    expect(
      cases.findOneAndUpdate.mock.calls[1]?.[1].$setOnInsert.sourceCreatedAt,
    ).toEqual(createdAt);
  });
});
