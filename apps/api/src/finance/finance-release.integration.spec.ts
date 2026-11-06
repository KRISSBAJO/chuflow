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
  ) => {
    const method = Reflect.get(service, 'reviewFinanceEntry') as (
      kind: string,
      id: string,
      dto: ReviewExpenseEntryDto,
      actor: AuthUser,
      decision: string,
    ) => Promise<void>;
    return method.call(service, 'offering', id, dto, actor, 'approved');
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
});
