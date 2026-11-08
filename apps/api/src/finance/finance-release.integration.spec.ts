import { createConnection, Connection, Types } from 'mongoose';
import { FinanceService } from './finance.service';
import {
  OfferingEntry,
  OfferingEntrySchema,
} from './schemas/offering-entry.schema';
import {
  ExpenseEntry,
  ExpenseEntrySchema,
} from './schemas/expense-entry.schema';
import {
  FinanceLedgerEntry,
  FinanceLedgerEntrySchema,
} from './schemas/finance-ledger-entry.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import type { ReviewExpenseEntryDto } from './dto/create-expense-entry.dto';
import { FinanceFormKind, GuestFieldsService } from '../guests/guest-fields.service';

// Run against a dedicated local replica set; never uses the application's database.
const run = process.env.CHUFLOW_RELEASE_QA === '1' ? describe : describe.skip;
run('finance atomic release checks', () => {
  let db: Connection;
  let service: FinanceService;
  const branch = new Types.ObjectId();
  const creator = new Types.ObjectId();
  const reviewer = new Types.ObjectId();
  const account = new Types.ObjectId();
  const user: AuthUser = {
    sub: String(reviewer),
    email: 'reviewer@example.test',
    role: 'branch_admin',
    branchId: String(branch),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  beforeAll(async () => {
    db = await createConnection(
      'mongodb://127.0.0.1:27129/chuflow_finance_release_tests?replicaSet=chuflow-release-qa',
    ).asPromise();
    db.model(OfferingEntry.name, OfferingEntrySchema);
    db.model(ExpenseEntry.name, ExpenseEntrySchema);
    db.model(FinanceLedgerEntry.name, FinanceLedgerEntrySchema);
    await Promise.all(Object.values(db.models).map((model) => model.init()));
  });
  beforeEach(async () => {
    await Promise.all(
      Object.values(db.models).map((model) => model.deleteMany({})),
    );
    service = Object.create(FinanceService.prototype) as FinanceService;
    Object.assign(service, {
      offeringEntryModel: db.model(OfferingEntry.name),
      expenseEntryModel: db.model(ExpenseEntry.name),
      ledgerEntryModel: db.model(FinanceLedgerEntry.name),
      accessScopeService: {
        ensureBranchAccess: jest.fn().mockResolvedValue(undefined),
      },
      auditLogsService: audit,
      ensurePeriodOpen: jest.fn().mockResolvedValue(undefined),
    });
  });
  afterAll(async () => {
    await db.close();
  });
  const fixture = () =>
    db
      .model(OfferingEntry.name)
      .create({
        branchId: branch,
        oversightRegion: 'USA',
        district: 'QA',
        serviceDate: new Date('2026-11-01'),
        serviceTypeId: new Types.ObjectId(),
        serviceTypeKey: 'sunday',
        serviceTypeLabel: 'Sunday',
        offeringTypeId: new Types.ObjectId(),
        offeringTypeKey: 'offering',
        offeringTypeLabel: 'Offering',
        accountId: account,
        accountKey: 'main',
        accountLabel: 'Main',
        amount: 100,
        currency: 'USD',
        createdBy: creator,
        updatedBy: creator,
        status: 'submitted',
        reviewRevision: 0,
      });
  const review = (
    id: string,
    dto: ReviewExpenseEntryDto = { reviewRevision: 0 },
    actor = user,
    kind = 'offering',
  ) => {
    const method = Reflect.get(service, 'reviewFinanceEntry') as (
      kind: string,
      id: string,
      dto: ReviewExpenseEntryDto,
      actor: AuthUser,
      decision: string,
    ) => Promise<void>;
    return method.call(service, kind, id, dto, actor, 'approved');
  };
  it('commits the source entry and credit together, preserving the author', async () => {
    const entry = await fixture();
    await review(String(entry._id));
    const source = await db
      .model(OfferingEntry.name)
      .findById(entry._id)
      .lean();
    const ledger = await db
      .model(FinanceLedgerEntry.name)
      .findOne({ sourceId: String(entry._id) })
      .lean();
    expect(source?.status).toBe('approved');
    expect(ledger?.status).toBe('approved');
    expect(String(source?.createdBy)).toBe(String(creator));
    expect(String(source?.approvedBy)).toBe(String(reviewer));
  });
  it('rolls back the approval when writing the ledger fails', async () => {
    const entry = await fixture();
    Object.assign(service, {
      syncLedgerEntry: jest
        .fn()
        .mockRejectedValue(new Error('ledger unavailable')),
    });
    await expect(review(String(entry._id))).rejects.toThrow(
      'ledger unavailable',
    );
    expect(
      (await db.model(OfferingEntry.name).findById(entry._id).lean())?.status,
    ).toBe('submitted');
  });
  it('blocks self-review, stale review and closed periods without creating a credit', async () => {
    const entry = await fixture();
    await expect(
      review(String(entry._id), {}, { ...user, sub: String(creator) }),
    ).rejects.toThrow('different authorized');
    await expect(
      review(String(entry._id), { reviewRevision: 3 }),
    ).rejects.toThrow('changed');
    Object.assign(service, {
      ensurePeriodOpen: jest.fn().mockRejectedValue(new Error('locked period')),
    });
    await expect(review(String(entry._id))).rejects.toThrow('locked period');
    expect(await db.model(FinanceLedgerEntry.name).countDocuments()).toBe(0);
  });
  it('allows exactly one concurrent reviewer to commit', async () => {
    const entry = await fixture();
    const results = await Promise.allSettled([
      review(String(entry._id)),
      review(String(entry._id)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.model(FinanceLedgerEntry.name).countDocuments()).toBe(1);
  });
  it('removes stale approval metadata when an entry is resubmitted', async () => {
    const entry = await fixture();
    await review(String(entry._id));
    const sync = Reflect.get(service, 'syncLedgerEntry') as (
      params: Record<string, unknown>,
    ) => Promise<void>;
    await sync.call(service, {
      branchId: String(branch),
      oversightRegion: 'USA',
      district: 'QA',
      entryDate: new Date('2026-11-01'),
      accountId: String(account),
      accountKey: 'main',
      accountLabel: 'Main',
      direction: 'credit',
      sourceType: 'offering',
      sourceId: String(entry._id),
      amount: 120,
      currency: 'USD',
      description: 'Offering',
      status: 'submitted',
      createdBy: String(creator),
      updatedBy: String(creator),
    });
    const ledger = await db
      .model(FinanceLedgerEntry.name)
      .findOne({ sourceId: String(entry._id) })
      .lean();
    expect(ledger?.status).toBe('submitted');
    expect(ledger?.approvedBy).toBeUndefined();
    expect(ledger?.reviewedAt).toBeUndefined();
  });

  it.each(['offering', 'expense'] as const)(
    'sends an approved %s back for independent review after a custom answer changes',
    async (kind) => {
      const schedule = new Types.ObjectId();
      const instance = new Types.ObjectId();
      const category = { _id: new Types.ObjectId(), key: 'supplies', name: 'Supplies' };
      const model = db.model(kind === 'offering' ? OfferingEntry.name : ExpenseEntry.name);
      const original = kind === 'offering' ? await fixture() : await model.create({
        branchId: branch, oversightRegion: 'USA', district: 'QA',
        expenseDate: new Date('2026-11-01'),
        accountId: account, accountKey: 'main', accountLabel: 'Main',
        expenseCategoryId: category._id, expenseCategoryKey: category.key, expenseCategoryLabel: category.name,
        description: 'Supplies', amount: 100, currency: 'USD', createdBy: creator, updatedBy: creator,
      });
      const activeKey = 'custom_reference';
      const archivedKey = 'custom_archived';
      await model.updateOne({ _id: original._id }, { $set: {
        status: 'approved', reviewRevision: 2, approvedBy: reviewer,
        serviceScheduleId: schedule, serviceInstanceId: instance,
        customAnswers: [{ key: archivedKey, label: 'Earlier answer', value: 'Keep' }, { key: activeKey, label: 'Reference', value: 'Old' }],
      } });
      const forms = Object.create(GuestFieldsService.prototype) as GuestFieldsService;
      Object.assign(forms, { get: jest.fn().mockResolvedValue({
        revision: 1, hiddenStaff: ['notes'], fields: [{ key: activeKey, label: 'Reference', type: 'text', staff: true, required: true, options: [] }],
      }) });
      const resolveAccount = jest.fn().mockResolvedValue({ _id: account, key: 'main', name: 'Main' });
      const id = String(original._id);
      Object.assign(service, {
        forms,
        resolveOfferingType: jest.fn().mockResolvedValue({ _id: original.offeringTypeId, key: 'offering', name: 'Offering' }),
        resolveServiceType: jest.fn().mockResolvedValue({ _id: original.serviceTypeId, key: 'sunday', name: 'Sunday' }),
        resolveOfferingAccount: resolveAccount,
        resolveFinanceAccount: resolveAccount,
        resolveExpenseCategory: jest.fn().mockResolvedValue(category),
        serviceSchedulesService: { resolveServiceInstanceForEntry: jest.fn().mockResolvedValue(undefined) },
        findOfferingEntry: jest.fn().mockResolvedValue(undefined),
        findExpenseEntry: jest.fn().mockResolvedValue(undefined),
      });
      const oversight = { ...user, role: 'super_admin' as const };
      const update = kind === 'offering' ? service.updateOfferingEntry.bind(service) : service.updateExpenseEntry.bind(service);
      await expect(update(id, { formRevision: 0, customFields: { [activeKey]: 'Stale' } }, oversight)).rejects.toThrow('form has changed');
      await expect(update(id, { reviewRevision: 1, formRevision: 1, customFields: { [activeKey]: 'Stale' } }, oversight)).rejects.toThrow('Refresh before editing');
      const periodCheck = jest.fn().mockRejectedValueOnce(new Error('locked period')).mockResolvedValue(undefined);
      Object.assign(service, { ensurePeriodOpen: periodCheck });
      const change = { reviewRevision: 2, formRevision: 1, notes: 'Hidden', customFields: { [activeKey]: 'New' } };
      await expect(update(id, change, oversight)).rejects.toThrow('locked period');
      expect((await model.findById(id).lean())?.status).toBe('approved');
      await update(id, change, oversight);
      const stored = await model.findById(id).select('+customAnswers').lean();
      expect(stored).toMatchObject({
        status: 'submitted', reviewRevision: 3, approvedBy: null, amount: 100,
        customAnswers: [{ key: archivedKey, label: 'Earlier answer', value: 'Keep' }, { key: activeKey, label: 'Reference', value: 'New' }],
      });
      expect(stored?.notes).toBeUndefined();
      expect(resolveAccount.mock.calls[0][0]).toBe(String(account));
      expect(await db.model(FinanceLedgerEntry.name).findOne({ sourceId: id }).lean()).toMatchObject({
        status: 'submitted', serviceScheduleId: schedule, serviceInstanceId: instance, amount: 100,
      });
      await expect(review(id, { reviewRevision: 3 }, oversight, kind)).rejects.toThrow('different authorized');
    },
  );

  it('keeps offering and expense definitions separate and finance fields private', async () => {
    const definitions = db.db!.collection('guest_form_settings');
    await definitions.deleteMany({});
    const forms = new GuestFieldsService(
      db,
      {} as ConstructorParameters<typeof GuestFieldsService>[1],
      audit as unknown as ConstructorParameters<typeof GuestFieldsService>[2],
    );
    try {
      const field = { label: 'Reference', type: 'text', public: false, staff: true, required: true, options: [] };
      const change = { revision: 0, hiddenPublic: [], hiddenStaff: ['notes'], fields: [field] };
      await expect(forms.publish({ ...change, fields: [{ ...field, public: true }] }, user, FinanceFormKind.Offering)).rejects.toThrow('Invalid form');
      await expect(forms.publish({ ...change, hiddenStaff: ['amount'] }, user, FinanceFormKind.Offering)).rejects.toThrow('Invalid form');
      const result = await forms.publish(change, user, FinanceFormKind.Offering);
      expect(result.fields).toHaveLength(1);
      expect(await forms.staff(FinanceFormKind.Expense)).toMatchObject({ revision: 0, fields: [] });
      expect(await forms.staff(FinanceFormKind.Offering)).toMatchObject({ revision: 1, hiddenStaff: ['notes'] });
    } finally {
      await definitions.deleteMany({});
    }
  });
});
