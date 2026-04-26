import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
} from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { ServiceSchedulesService } from '../service-schedules/service-schedules.service';
import { ServiceType, ServiceTypeDocument } from '../service-types/schemas/service-type.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateExpenseCategoryDto, UpdateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { CreateExpenseEntryDto, ReviewExpenseEntryDto, UpdateExpenseEntryDto } from './dto/create-expense-entry.dto';
import { CreateFinanceAccountDto, UpdateFinanceAccountDto } from './dto/create-finance-account.dto';
import { CreateFinanceLockDto } from './dto/create-finance-lock.dto';
import { CreateOfferingEntryDto, UpdateOfferingEntryDto } from './dto/create-offering-entry.dto';
import { CreateOfferingTypeDto, UpdateOfferingTypeDto } from './dto/create-offering-type.dto';
import { ExpenseCategory, ExpenseCategoryDocument } from './schemas/expense-category.schema';
import { ExpenseEntry, ExpenseEntryDocument } from './schemas/expense-entry.schema';
import { FinanceAccount, FinanceAccountDocument } from './schemas/finance-account.schema';
import { FinanceLedgerEntry, FinanceLedgerEntryDocument } from './schemas/finance-ledger-entry.schema';
import { FinanceLock, FinanceLockDocument } from './schemas/finance-lock.schema';
import { OfferingEntry, OfferingEntryDocument } from './schemas/offering-entry.schema';
import { OfferingType, OfferingTypeDocument } from './schemas/offering-type.schema';

const DEFAULT_OFFERING_TYPES = [
  { name: 'Tithe', key: 'tithe', description: 'Regular tithe giving', sortOrder: 10 },
  { name: 'Sunday Offering', key: 'sunday_offering', description: 'General service offering', sortOrder: 20 },
  { name: 'Thanksgiving', key: 'thanksgiving', description: 'Thanksgiving and gratitude offerings', sortOrder: 30 },
  { name: 'Building Fund', key: 'building_fund', description: 'Facility and project support', sortOrder: 40 },
  { name: 'Welfare', key: 'welfare', description: 'Care and benevolence support', sortOrder: 50 },
  { name: 'Mission Offering', key: 'mission_offering', description: 'Mission and outreach support', sortOrder: 60 },
  { name: 'Children Offering', key: 'children_offering', description: 'Children church giving', sortOrder: 70 },
  { name: 'First Fruits', key: 'first_fruits', description: 'First fruits giving', sortOrder: 80 },
];

const DEFAULT_FINANCE_ACCOUNTS = [
  { name: 'General Fund', key: 'general_fund', description: 'General branch operating balance', sortOrder: 10 },
  { name: 'Tithe Fund', key: 'tithe_fund', description: 'Tithe-specific balance and reporting', sortOrder: 20 },
  { name: 'Building Fund', key: 'building_fund', description: 'Facility and capital project account', sortOrder: 30 },
  { name: 'Welfare Fund', key: 'welfare_fund', description: 'Care and benevolence balance', sortOrder: 40 },
  { name: 'Mission Fund', key: 'mission_fund', description: 'Mission and outreach support account', sortOrder: 50 },
  { name: 'Children Fund', key: 'children_fund', description: 'Children ministry balance', sortOrder: 60 },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Utilities', key: 'utilities', description: 'Power, water, internet, and service utilities', defaultAccountKey: 'general_fund', sortOrder: 10 },
  { name: 'Welfare Support', key: 'welfare_support', description: 'Benevolence and member care support', defaultAccountKey: 'welfare_fund', sortOrder: 20 },
  { name: 'Facility Maintenance', key: 'facility_maintenance', description: 'Repairs, cleaning, and maintenance', defaultAccountKey: 'building_fund', sortOrder: 30 },
  { name: 'Ministry Operations', key: 'ministry_operations', description: 'General ministry operations and service supplies', defaultAccountKey: 'general_fund', sortOrder: 40 },
  { name: 'Missions', key: 'missions', description: 'Mission support and outreach spending', defaultAccountKey: 'mission_fund', sortOrder: 50 },
  { name: 'Children Ministry', key: 'children_ministry', description: 'Children ministry materials and support', defaultAccountKey: 'children_fund', sortOrder: 60 },
];

type ScopedBranch = {
  _id: Types.ObjectId;
  name: string;
  oversightRegion: string;
  district: string;
  city?: string;
  state?: string;
};

@Injectable()
export class FinanceService implements OnModuleInit {
  constructor(
    @InjectModel(OfferingType.name)
    private readonly offeringTypeModel: Model<OfferingTypeDocument>,
    @InjectModel(OfferingEntry.name)
    private readonly offeringEntryModel: Model<OfferingEntryDocument>,
    @InjectModel(FinanceAccount.name)
    private readonly financeAccountModel: Model<FinanceAccountDocument>,
    @InjectModel(ExpenseCategory.name)
    private readonly expenseCategoryModel: Model<ExpenseCategoryDocument>,
    @InjectModel(ExpenseEntry.name)
    private readonly expenseEntryModel: Model<ExpenseEntryDocument>,
    @InjectModel(FinanceLedgerEntry.name)
    private readonly ledgerEntryModel: Model<FinanceLedgerEntryDocument>,
    @InjectModel(FinanceLock.name)
    private readonly financeLockModel: Model<FinanceLockDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(ServiceType.name)
    private readonly serviceTypeModel: Model<ServiceTypeDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly accessScopeService: AccessScopeService,
    private readonly auditLogsService: AuditLogsService,
    private readonly serviceSchedulesService: ServiceSchedulesService,
  ) {}

  async onModuleInit() {
    for (const defaultType of DEFAULT_OFFERING_TYPES) {
      const existing = await this.offeringTypeModel.findOne({ key: defaultType.key }).lean();

      if (!existing) {
        await this.offeringTypeModel.create({
          ...defaultType,
          isActive: true,
          isSeeded: true,
        });
      }
    }

    for (const account of DEFAULT_FINANCE_ACCOUNTS) {
      const existing = await this.financeAccountModel.findOne({ key: account.key }).lean();

      if (!existing) {
        await this.financeAccountModel.create({
          ...account,
          isActive: true,
          isSeeded: true,
        });
      }
    }

    for (const category of DEFAULT_EXPENSE_CATEGORIES) {
      const existing = await this.expenseCategoryModel.findOne({ key: category.key }).lean();

      if (!existing) {
        await this.expenseCategoryModel.create({
          ...category,
          isActive: true,
          isSeeded: true,
        });
      }
    }
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private normalizeFilterValue(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private validatePastOrTodayDate(value: string | Date, label: string) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${label} must be a valid date`);
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    if (date.getTime() > endOfToday.getTime()) {
      throw new BadRequestException(`${label} cannot be in the future`);
    }

    return date;
  }

  private getPeriodKey(date: Date) {
    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
  }

  private getDefaultAccountKeyForOffering(offeringTypeKey: string) {
    const mapping: Record<string, string> = {
      tithe: 'tithe_fund',
      first_fruits: 'tithe_fund',
      building_fund: 'building_fund',
      welfare: 'welfare_fund',
      mission_offering: 'mission_fund',
      children_offering: 'children_fund',
      sunday_offering: 'general_fund',
      thanksgiving: 'general_fund',
    };

    return mapping[offeringTypeKey] || 'general_fund';
  }

  private ensureFinanceViewRole(currentUser: AuthUser) {
    const allowed = [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
      'usher',
    ];

    if (!allowed.includes(currentUser.role)) {
      throw new ForbiddenException('You cannot access finance records from your role');
    }
  }

  private ensureGlobalFinanceManager(currentUser: AuthUser) {
    if (currentUser.role !== 'super_admin') {
      throw new ForbiddenException('Only overall oversight admin can manage global finance defaults');
    }
  }

  private ensureOfferingEntryCreator(currentUser: AuthUser) {
    if (!['usher', 'resident_pastor', 'associate_pastor'].includes(currentUser.role)) {
      throw new ForbiddenException(
        'Only ushers, resident pastors, and associate pastors can enter offerings',
      );
    }
  }

  private ensureExpenseEntryCreator(currentUser: AuthUser) {
    const allowed = [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
    ];

    if (!allowed.includes(currentUser.role)) {
      throw new ForbiddenException('Your role cannot create expense entries');
    }
  }

  private ensureExpenseApprover(currentUser: AuthUser) {
    const allowed = [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
    ];

    if (!allowed.includes(currentUser.role)) {
      throw new ForbiddenException('Your role cannot approve finance entries');
    }
  }

  private ensureFinanceLockManager(currentUser: AuthUser) {
    const allowed = [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
    ];

    if (!allowed.includes(currentUser.role)) {
      throw new ForbiddenException('Your role cannot lock finance periods');
    }
  }

  private async ensureUniqueRecord(
    model: Model<unknown>,
    name: string,
    key: string,
    currentId?: string,
  ) {
    const existing = await model.findOne({
      ...(currentId ? { _id: { $ne: currentId } } : {}),
      $or: [
        { name: { $regex: new RegExp(`^${this.escapeRegExp(name)}$`, 'i') } },
        { key: { $regex: new RegExp(`^${this.escapeRegExp(key)}$`, 'i') } },
      ],
    });

    if (existing) {
      throw new BadRequestException('A record with this name or key already exists');
    }
  }

  private async resolveVisibleBranches(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      oversightRegion?: string;
      district?: string;
    } = {},
  ) {
    const requestedBranchId = this.normalizeFilterValue(filters.branchId);
    const requestedOversightRegion = this.normalizeFilterValue(filters.oversightRegion);
    const requestedDistrict = this.normalizeFilterValue(filters.district);

    const scopedQuery = {
      ...(await this.accessScopeService.getBranchDocumentQuery(currentUser)),
    } as Record<string, unknown>;

    if (requestedBranchId) {
      await this.accessScopeService.ensureBranchAccess(currentUser, requestedBranchId);
      scopedQuery._id = new Types.ObjectId(requestedBranchId);
    } else {
      if (requestedOversightRegion) {
        scopedQuery.oversightRegion = requestedOversightRegion;
      }

      if (requestedDistrict) {
        scopedQuery.district = requestedDistrict;
      }
    }

    return this.branchModel
      .find(scopedQuery)
      .select('name oversightRegion district city state')
      .sort({ oversightRegion: 1, district: 1, name: 1 })
      .lean<ScopedBranch[]>();
  }

  private getBranchObjectIdMatch(branches: ScopedBranch[]) {
    const branchIds = branches.map((branch) => new Types.ObjectId(String(branch._id)));

    if (branchIds.length === 0) {
      return undefined;
    }

    return branchIds.length === 1 ? branchIds[0] : { $in: branchIds };
  }

  private async resolveScopedCreateBranch(currentUser: AuthUser, requestedBranchId?: string) {
    const branchId = await this.accessScopeService.resolveScopedBranchId(currentUser, requestedBranchId);

    if (!branchId) {
      throw new BadRequestException('A branch is required');
    }

    const branch = await this.branchModel
      .findById(branchId)
      .select('name oversightRegion district')
      .lean();

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch as Branch & { _id: Types.ObjectId };
  }

  private async resolveOfferingType(offeringTypeId: string) {
    const offeringType = await this.offeringTypeModel.findById(offeringTypeId).lean();

    if (!offeringType) {
      throw new NotFoundException('Offering type not found');
    }

    return offeringType;
  }

  private async resolveServiceType(branchId: string, serviceTypeId: string) {
    const serviceType = await this.serviceTypeModel.findById(serviceTypeId).lean();

    if (!serviceType) {
      throw new NotFoundException('Service type not found');
    }

    if (String(serviceType.branchId) !== String(branchId)) {
      throw new ForbiddenException('Service type must belong to the same branch');
    }

    return serviceType;
  }

  private async resolveFinanceAccount(accountIdOrKey: string) {
    const query = Types.ObjectId.isValid(accountIdOrKey)
      ? { _id: new Types.ObjectId(accountIdOrKey) }
      : { key: accountIdOrKey };

    const account = await this.financeAccountModel.findOne(query).lean();

    if (!account) {
      throw new NotFoundException('Finance account not found');
    }

    return account;
  }

  private async resolveExpenseCategory(expenseCategoryId: string) {
    const category = await this.expenseCategoryModel.findById(expenseCategoryId).lean();

    if (!category) {
      throw new NotFoundException('Expense category not found');
    }

    return category;
  }

  private async resolveOfferingAccount(accountId: string | undefined, offeringTypeKey: string) {
    if (accountId) {
      return this.resolveFinanceAccount(accountId);
    }

    return this.resolveFinanceAccount(this.getDefaultAccountKeyForOffering(offeringTypeKey));
  }

  private async ensurePeriodOpen(branchId: string, entryDate: Date) {
    const periodKey = this.getPeriodKey(entryDate);
    const existingLock = await this.financeLockModel.findOne({ branchId, periodKey }).lean();

    if (existingLock) {
      throw new ForbiddenException('This finance period is locked for the selected branch');
    }
  }

  private isSameCalendarMonth(left: Date, right: Date) {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth()
    );
  }

  private getOfferingEditPermission(
    currentUser: AuthUser,
    offering: {
      branchId?: unknown;
      serviceDate?: Date;
      createdAt?: Date;
    },
  ) {
    const now = new Date();
    const serviceDate = offering.serviceDate ? new Date(offering.serviceDate) : now;
    const createdAt = offering.createdAt ? new Date(offering.createdAt) : now;

    if (
      isGlobalRole(currentUser.role) ||
      isNationalRole(currentUser.role) ||
      isDistrictRole(currentUser.role)
    ) {
      return {
        canEdit: true,
        reason: 'Oversight roles can correct finance records across their visible scope.',
      };
    }

    if (currentUser.role === 'branch_admin') {
      return this.isSameCalendarMonth(serviceDate, now)
        ? {
            canEdit: true,
            reason: 'Branch admin can update finance records during the active service month.',
          }
        : {
            canEdit: false,
            reason: 'Branch admins can only edit offering records while the service month is still open.',
          };
    }

    if (['usher', 'resident_pastor', 'associate_pastor'].includes(currentUser.role)) {
      if (!this.isSameCalendarMonth(serviceDate, now)) {
        return {
          canEdit: false,
          reason: 'Branch-level offering entry closes after the service month ends.',
        };
      }

      if (now.getTime() - createdAt.getTime() > 24 * 60 * 60 * 1000) {
        return {
          canEdit: false,
          reason: 'Direct entry roles can only edit offerings during the first 24 hours after entry.',
        };
      }

      return {
        canEdit: true,
        reason: 'Entry roles can edit an offering during the first 24 hours after entry.',
      };
    }

    return {
      canEdit: false,
      reason: 'This role cannot edit finance records.',
    };
  }

  private getExpenseEditPermission(
    currentUser: AuthUser,
    expense: {
      expenseDate?: Date;
      createdAt?: Date;
      status?: string;
    },
  ) {
    const now = new Date();
    const expenseDate = expense.expenseDate ? new Date(expense.expenseDate) : now;

    if (
      isGlobalRole(currentUser.role) ||
      isNationalRole(currentUser.role) ||
      isDistrictRole(currentUser.role)
    ) {
      return {
        canEdit: true,
        reason: 'Oversight roles can correct expense records across their visible scope.',
      };
    }

    if (expense.status === 'locked') {
      return {
        canEdit: false,
        reason: 'Locked expenses must be reopened by finance oversight before editing.',
      };
    }

    if (['branch_admin', 'resident_pastor', 'associate_pastor'].includes(currentUser.role)) {
      return this.isSameCalendarMonth(expenseDate, now)
        ? {
            canEdit: true,
            reason: 'Branch leadership can edit expenses while the service month is still open.',
          }
        : {
            canEdit: false,
            reason: 'Branch leadership can only edit expenses while the service month is still open.',
          };
    }

    return {
      canEdit: false,
      reason: 'This role cannot edit expense records.',
    };
  }

  private async syncLedgerEntry(params: {
    branchId: string;
    oversightRegion: string;
    district: string;
    entryDate: Date;
    accountId: string;
    accountKey: string;
    accountLabel: string;
    direction: 'credit' | 'debit';
    sourceType: 'offering' | 'expense' | 'adjustment';
    sourceId: string;
    serviceScheduleId?: string;
    serviceInstanceId?: string;
    serviceLabel?: string;
    amount: number;
    currency: string;
    description: string;
    status: 'approved' | 'submitted' | 'rejected' | 'locked';
    createdBy: string;
    updatedBy?: string;
    approvedBy?: string;
    reviewedAt?: Date;
  }) {
    const periodKey = this.getPeriodKey(params.entryDate);

    await this.ledgerEntryModel.findOneAndUpdate(
      { sourceType: params.sourceType, sourceId: params.sourceId },
      {
        branchId: new Types.ObjectId(params.branchId),
        oversightRegion: params.oversightRegion,
        district: params.district,
        entryDate: params.entryDate,
        periodKey,
        accountId: new Types.ObjectId(params.accountId),
        accountKey: params.accountKey,
        accountLabel: params.accountLabel,
        direction: params.direction,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        serviceScheduleId: params.serviceScheduleId
          ? new Types.ObjectId(params.serviceScheduleId)
          : undefined,
        serviceInstanceId: params.serviceInstanceId
          ? new Types.ObjectId(params.serviceInstanceId)
          : undefined,
        serviceLabel: params.serviceLabel,
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        status: params.status,
        createdBy: new Types.ObjectId(params.createdBy),
        updatedBy: params.updatedBy ? new Types.ObjectId(params.updatedBy) : undefined,
        approvedBy: params.approvedBy ? new Types.ObjectId(params.approvedBy) : undefined,
        reviewedAt: params.reviewedAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  private async applyLockStateToPeriod(branchId: string, periodKey: string, locked: boolean) {
    const branchObjectId = new Types.ObjectId(branchId);
    const [year, month] = periodKey.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const nextPeriodStart = new Date(year, month, 1, 0, 0, 0, 0);

    await this.expenseEntryModel.updateMany(
      {
        branchId: branchObjectId,
        expenseDate: { $gte: periodStart, $lt: nextPeriodStart },
      },
      locked
        ? { status: 'locked' }
        : [
            {
              $set: {
                status: {
                  $cond: [{ $ifNull: ['$approvedBy', false] }, 'approved', 'submitted'],
                },
              },
            },
          ],
    );

    await this.ledgerEntryModel.updateMany(
      {
        branchId: branchObjectId,
        periodKey,
      },
      locked
        ? { status: 'locked' }
        : [
            {
              $set: {
                status: {
                  $cond: [{ $eq: ['$sourceType', 'expense'] }, 'approved', 'approved'],
                },
              },
            },
          ],
    );
  }

  private toFinanceAccountResponse(account: FinanceAccount & { _id?: unknown; createdAt?: Date; updatedAt?: Date }) {
    return {
      _id: String(account._id),
      name: account.name,
      key: account.key,
      description: account.description,
      isActive: account.isActive,
      isSeeded: account.isSeeded,
      sortOrder: account.sortOrder ?? 0,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private toExpenseCategoryResponse(category: ExpenseCategory & { _id?: unknown; createdAt?: Date; updatedAt?: Date }) {
    return {
      _id: String(category._id),
      name: category.name,
      key: category.key,
      description: category.description,
      defaultAccountKey: category.defaultAccountKey,
      isActive: category.isActive,
      isSeeded: category.isSeeded,
      sortOrder: category.sortOrder ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private toOfferingTypeResponse(offeringType: OfferingType & { _id?: unknown; createdAt?: Date; updatedAt?: Date }) {
    return {
      _id: String(offeringType._id),
      name: offeringType.name,
      key: offeringType.key,
      description: offeringType.description,
      isActive: offeringType.isActive,
      isSeeded: offeringType.isSeeded,
      sortOrder: offeringType.sortOrder ?? 0,
      createdAt: offeringType.createdAt,
      updatedAt: offeringType.updatedAt,
    };
  }

  private toOfferingEntryResponse(entry: Record<string, unknown>, currentUser: AuthUser) {
    const branchValue =
      typeof entry.branchId === 'object' && entry.branchId !== null
        ? {
            _id: String((entry.branchId as { _id?: unknown })._id ?? ''),
            name: (entry.branchId as { name?: string }).name,
            oversightRegion: (entry.branchId as { oversightRegion?: string }).oversightRegion,
            district: (entry.branchId as { district?: string }).district,
          }
        : undefined;

    const serviceTypeValue =
      typeof entry.serviceTypeId === 'object' && entry.serviceTypeId !== null
        ? {
            _id: String((entry.serviceTypeId as { _id?: unknown })._id ?? ''),
            name: (entry.serviceTypeId as { name?: string }).name,
            key: (entry.serviceTypeId as { key?: string }).key,
          }
        : undefined;

    const offeringTypeValue =
      typeof entry.offeringTypeId === 'object' && entry.offeringTypeId !== null
        ? {
            _id: String((entry.offeringTypeId as { _id?: unknown })._id ?? ''),
            name: (entry.offeringTypeId as { name?: string }).name,
            key: (entry.offeringTypeId as { key?: string }).key,
            isActive: (entry.offeringTypeId as { isActive?: boolean }).isActive,
          }
        : undefined;

    const accountValue =
      typeof entry.accountId === 'object' && entry.accountId !== null
        ? {
            _id: String((entry.accountId as { _id?: unknown })._id ?? ''),
            name: (entry.accountId as { name?: string }).name,
            key: (entry.accountId as { key?: string }).key,
          }
        : entry.accountId
          ? {
              _id: String(entry.accountId),
              name: entry.accountLabel ? String(entry.accountLabel) : undefined,
              key: entry.accountKey ? String(entry.accountKey) : undefined,
            }
          : undefined;

    const createdByValue =
      typeof entry.createdBy === 'object' && entry.createdBy !== null
        ? {
            _id: String((entry.createdBy as { _id?: unknown })._id ?? ''),
            firstName: (entry.createdBy as { firstName?: string }).firstName,
            lastName: (entry.createdBy as { lastName?: string }).lastName,
            email: (entry.createdBy as { email?: string }).email,
            role: (entry.createdBy as { role?: string }).role,
          }
        : undefined;

    const updatedByValue =
      typeof entry.updatedBy === 'object' && entry.updatedBy !== null
        ? {
            _id: String((entry.updatedBy as { _id?: unknown })._id ?? ''),
            firstName: (entry.updatedBy as { firstName?: string }).firstName,
            lastName: (entry.updatedBy as { lastName?: string }).lastName,
            email: (entry.updatedBy as { email?: string }).email,
            role: (entry.updatedBy as { role?: string }).role,
          }
        : undefined;

    return {
      _id: String(entry._id),
      branchId: branchValue,
      oversightRegion: String(entry.oversightRegion ?? ''),
      district: String(entry.district ?? ''),
      serviceDate: new Date(String(entry.serviceDate)),
      serviceTypeId: serviceTypeValue,
      serviceTypeKey: String(entry.serviceTypeKey ?? ''),
      serviceTypeLabel: String(entry.serviceTypeLabel ?? ''),
      serviceScheduleId:
        entry.serviceScheduleId && typeof entry.serviceScheduleId === 'object' && entry.serviceScheduleId !== null
          ? {
              _id: String((entry.serviceScheduleId as { _id?: unknown })._id ?? ''),
              name: (entry.serviceScheduleId as { name?: string }).name,
              dayOfWeek: (entry.serviceScheduleId as { dayOfWeek?: string }).dayOfWeek,
              startTime: (entry.serviceScheduleId as { startTime?: string }).startTime,
            }
          : undefined,
      serviceInstanceId:
        entry.serviceInstanceId && typeof entry.serviceInstanceId === 'object' && entry.serviceInstanceId !== null
          ? {
              _id: String((entry.serviceInstanceId as { _id?: unknown })._id ?? ''),
              serviceDateKey: (entry.serviceInstanceId as { serviceDateKey?: string }).serviceDateKey,
            }
          : undefined,
      serviceLabel: typeof entry.serviceLabel === 'string' ? entry.serviceLabel : undefined,
      offeringTypeId: offeringTypeValue,
      offeringTypeKey: String(entry.offeringTypeKey ?? ''),
      offeringTypeLabel: String(entry.offeringTypeLabel ?? ''),
      accountId: accountValue,
      amount: Number(entry.amount ?? 0),
      currency: String(entry.currency ?? 'USD'),
      notes: typeof entry.notes === 'string' ? entry.notes : undefined,
      createdBy: createdByValue,
      updatedBy: updatedByValue,
      createdAt: entry.createdAt ? new Date(String(entry.createdAt)) : undefined,
      updatedAt: entry.updatedAt ? new Date(String(entry.updatedAt)) : undefined,
      permissions: this.getOfferingEditPermission(currentUser, {
        branchId: branchValue?._id,
        serviceDate: entry.serviceDate ? new Date(String(entry.serviceDate)) : undefined,
        createdAt: entry.createdAt ? new Date(String(entry.createdAt)) : undefined,
      }),
    };
  }

  private toExpenseEntryResponse(entry: Record<string, unknown>, currentUser: AuthUser) {
    const branchValue =
      typeof entry.branchId === 'object' && entry.branchId !== null
        ? {
            _id: String((entry.branchId as { _id?: unknown })._id ?? ''),
            name: (entry.branchId as { name?: string }).name,
            oversightRegion: (entry.branchId as { oversightRegion?: string }).oversightRegion,
            district: (entry.branchId as { district?: string }).district,
          }
        : undefined;

    const accountValue =
      typeof entry.accountId === 'object' && entry.accountId !== null
        ? {
            _id: String((entry.accountId as { _id?: unknown })._id ?? ''),
            name: (entry.accountId as { name?: string }).name,
            key: (entry.accountId as { key?: string }).key,
          }
        : undefined;

    const categoryValue =
      typeof entry.expenseCategoryId === 'object' && entry.expenseCategoryId !== null
        ? {
            _id: String((entry.expenseCategoryId as { _id?: unknown })._id ?? ''),
            name: (entry.expenseCategoryId as { name?: string }).name,
            key: (entry.expenseCategoryId as { key?: string }).key,
          }
        : undefined;

    return {
      _id: String(entry._id),
      branchId: branchValue,
      oversightRegion: String(entry.oversightRegion ?? ''),
      district: String(entry.district ?? ''),
      expenseDate: new Date(String(entry.expenseDate)),
      accountId: accountValue,
      accountKey: String(entry.accountKey ?? ''),
      accountLabel: String(entry.accountLabel ?? ''),
      expenseCategoryId: categoryValue,
      expenseCategoryKey: String(entry.expenseCategoryKey ?? ''),
      expenseCategoryLabel: String(entry.expenseCategoryLabel ?? ''),
      serviceScheduleId:
        entry.serviceScheduleId && typeof entry.serviceScheduleId === 'object' && entry.serviceScheduleId !== null
          ? {
              _id: String((entry.serviceScheduleId as { _id?: unknown })._id ?? ''),
              name: (entry.serviceScheduleId as { name?: string }).name,
            }
          : undefined,
      serviceInstanceId:
        entry.serviceInstanceId && typeof entry.serviceInstanceId === 'object' && entry.serviceInstanceId !== null
          ? {
              _id: String((entry.serviceInstanceId as { _id?: unknown })._id ?? ''),
              serviceDateKey: (entry.serviceInstanceId as { serviceDateKey?: string }).serviceDateKey,
            }
          : undefined,
      serviceLabel: typeof entry.serviceLabel === 'string' ? entry.serviceLabel : undefined,
      payee: typeof entry.payee === 'string' ? entry.payee : undefined,
      description: String(entry.description ?? ''),
      amount: Number(entry.amount ?? 0),
      currency: String(entry.currency ?? 'USD'),
      receiptUrl: typeof entry.receiptUrl === 'string' ? entry.receiptUrl : undefined,
      notes: typeof entry.notes === 'string' ? entry.notes : undefined,
      status: String(entry.status ?? 'submitted'),
      reviewedAt: entry.reviewedAt ? new Date(String(entry.reviewedAt)) : undefined,
      reviewNotes: typeof entry.reviewNotes === 'string' ? entry.reviewNotes : undefined,
      permissions: this.getExpenseEditPermission(currentUser, {
        expenseDate: entry.expenseDate ? new Date(String(entry.expenseDate)) : undefined,
        createdAt: entry.createdAt ? new Date(String(entry.createdAt)) : undefined,
        status: typeof entry.status === 'string' ? entry.status : undefined,
      }),
    };
  }

  private toLedgerEntryResponse(entry: Record<string, unknown>) {
    return {
      _id: String(entry._id),
      branchId:
        typeof entry.branchId === 'object' && entry.branchId !== null
          ? {
              _id: String((entry.branchId as { _id?: unknown })._id ?? ''),
              name: (entry.branchId as { name?: string }).name,
              oversightRegion: (entry.branchId as { oversightRegion?: string }).oversightRegion,
              district: (entry.branchId as { district?: string }).district,
            }
          : undefined,
      oversightRegion: String(entry.oversightRegion ?? ''),
      district: String(entry.district ?? ''),
      entryDate: new Date(String(entry.entryDate)),
      periodKey: String(entry.periodKey ?? ''),
      accountId:
        typeof entry.accountId === 'object' && entry.accountId !== null
          ? {
              _id: String((entry.accountId as { _id?: unknown })._id ?? ''),
              name: (entry.accountId as { name?: string }).name,
              key: (entry.accountId as { key?: string }).key,
            }
          : undefined,
      accountKey: String(entry.accountKey ?? ''),
      accountLabel: String(entry.accountLabel ?? ''),
      direction: String(entry.direction ?? ''),
      sourceType: String(entry.sourceType ?? ''),
      sourceId: String(entry.sourceId ?? ''),
      serviceLabel: typeof entry.serviceLabel === 'string' ? entry.serviceLabel : undefined,
      amount: Number(entry.amount ?? 0),
      currency: String(entry.currency ?? 'USD'),
      description: String(entry.description ?? ''),
      status: String(entry.status ?? ''),
      reviewedAt: entry.reviewedAt ? new Date(String(entry.reviewedAt)) : undefined,
      createdAt: entry.createdAt ? new Date(String(entry.createdAt)) : undefined,
    };
  }

  async createOfferingType(dto: CreateOfferingTypeDto, currentUser: AuthUser) {
    this.ensureGlobalFinanceManager(currentUser);

    const name = dto.name.trim();
    const key = this.slugify(dto.key || dto.name);

    await this.ensureUniqueRecord(this.offeringTypeModel as unknown as Model<unknown>, name, key);

    const offeringType = await this.offeringTypeModel.create({
      name,
      key,
      description: dto.description?.trim() || undefined,
      isActive: dto.isActive ?? true,
      isSeeded: false,
      sortOrder: dto.sortOrder ?? 0,
    });

    await this.auditLogsService.record({
      entityType: 'offering_type',
      entityId: String(offeringType._id),
      action: 'created',
      summary: `Offering type ${name} created`,
      actor: currentUser,
      metadata: { name, key, isActive: dto.isActive ?? true },
    });

    return this.toOfferingTypeResponse(offeringType.toObject());
  }

  async listOfferingTypes(currentUser: AuthUser) {
    this.ensureFinanceViewRole(currentUser);

    const offeringTypes = await this.offeringTypeModel.find({}).sort({ sortOrder: 1, name: 1 }).lean();

    return offeringTypes.map((item) =>
      this.toOfferingTypeResponse(item as unknown as OfferingType & { _id?: unknown }),
    );
  }

  async updateOfferingType(id: string, dto: UpdateOfferingTypeDto, currentUser: AuthUser) {
    this.ensureGlobalFinanceManager(currentUser);

    const existing = await this.offeringTypeModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Offering type not found');
    }

    const name = dto.name?.trim() || existing.name;
    const key = this.slugify(dto.key || dto.name || existing.key);

    await this.ensureUniqueRecord(this.offeringTypeModel as unknown as Model<unknown>, name, key, id);

    await this.offeringTypeModel.findByIdAndUpdate(id, {
      ...(dto.name !== undefined ? { name } : {}),
      ...(dto.key !== undefined || dto.name !== undefined ? { key } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || undefined } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    });

    const updated = await this.offeringTypeModel.findById(id).lean();

    if (!updated) {
      throw new NotFoundException('Offering type not found');
    }

    await this.auditLogsService.record({
      entityType: 'offering_type',
      entityId: id,
      action: 'updated',
      summary: `Offering type ${updated.name} updated`,
      actor: currentUser,
      metadata: { name: updated.name, key: updated.key, isActive: updated.isActive },
    });

    return this.toOfferingTypeResponse(updated as unknown as OfferingType & { _id?: unknown });
  }

  async createFinanceAccount(dto: CreateFinanceAccountDto, currentUser: AuthUser) {
    this.ensureGlobalFinanceManager(currentUser);

    const name = dto.name.trim();
    const key = this.slugify(dto.key || dto.name);

    await this.ensureUniqueRecord(this.financeAccountModel as unknown as Model<unknown>, name, key);

    const account = await this.financeAccountModel.create({
      name,
      key,
      description: dto.description?.trim() || undefined,
      isActive: dto.isActive ?? true,
      isSeeded: false,
      sortOrder: dto.sortOrder ?? 0,
    });

    await this.auditLogsService.record({
      entityType: 'finance_account',
      entityId: String(account._id),
      action: 'created',
      summary: `Finance account ${name} created`,
      actor: currentUser,
      metadata: { name, key, isActive: dto.isActive ?? true },
    });

    return this.toFinanceAccountResponse(account.toObject());
  }

  async listFinanceAccounts(currentUser: AuthUser) {
    this.ensureFinanceViewRole(currentUser);
    const accounts = await this.financeAccountModel.find({}).sort({ sortOrder: 1, name: 1 }).lean();
    return accounts.map((item) =>
      this.toFinanceAccountResponse(item as unknown as FinanceAccount & { _id?: unknown }),
    );
  }

  async updateFinanceAccount(id: string, dto: UpdateFinanceAccountDto, currentUser: AuthUser) {
    this.ensureGlobalFinanceManager(currentUser);
    const existing = await this.financeAccountModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Finance account not found');
    }

    const name = dto.name?.trim() || existing.name;
    const key = this.slugify(dto.key || dto.name || existing.key);
    await this.ensureUniqueRecord(this.financeAccountModel as unknown as Model<unknown>, name, key, id);

    await this.financeAccountModel.findByIdAndUpdate(id, {
      ...(dto.name !== undefined ? { name } : {}),
      ...(dto.key !== undefined || dto.name !== undefined ? { key } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || undefined } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    });

    const updated = await this.financeAccountModel.findById(id).lean();

    if (!updated) {
      throw new NotFoundException('Finance account not found');
    }

    await this.auditLogsService.record({
      entityType: 'finance_account',
      entityId: id,
      action: 'updated',
      summary: `Finance account ${updated.name} updated`,
      actor: currentUser,
      metadata: { name: updated.name, key: updated.key, isActive: updated.isActive },
    });

    return this.toFinanceAccountResponse(updated as unknown as FinanceAccount & { _id?: unknown });
  }

  async createExpenseCategory(dto: CreateExpenseCategoryDto, currentUser: AuthUser) {
    this.ensureGlobalFinanceManager(currentUser);

    const name = dto.name.trim();
    const key = this.slugify(dto.key || dto.name);

    if (dto.defaultAccountKey) {
      await this.resolveFinanceAccount(dto.defaultAccountKey.trim());
    }

    await this.ensureUniqueRecord(this.expenseCategoryModel as unknown as Model<unknown>, name, key);

    const category = await this.expenseCategoryModel.create({
      name,
      key,
      description: dto.description?.trim() || undefined,
      defaultAccountKey: dto.defaultAccountKey?.trim() || undefined,
      isActive: dto.isActive ?? true,
      isSeeded: false,
      sortOrder: dto.sortOrder ?? 0,
    });

    await this.auditLogsService.record({
      entityType: 'expense_category',
      entityId: String(category._id),
      action: 'created',
      summary: `Expense category ${name} created`,
      actor: currentUser,
      metadata: { name, key, defaultAccountKey: dto.defaultAccountKey?.trim() || undefined },
    });

    return this.toExpenseCategoryResponse(category.toObject());
  }

  async listExpenseCategories(currentUser: AuthUser) {
    this.ensureFinanceViewRole(currentUser);
    const categories = await this.expenseCategoryModel.find({}).sort({ sortOrder: 1, name: 1 }).lean();
    return categories.map((item) =>
      this.toExpenseCategoryResponse(item as unknown as ExpenseCategory & { _id?: unknown }),
    );
  }

  async updateExpenseCategory(id: string, dto: UpdateExpenseCategoryDto, currentUser: AuthUser) {
    this.ensureGlobalFinanceManager(currentUser);

    const existing = await this.expenseCategoryModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Expense category not found');
    }

    const name = dto.name?.trim() || existing.name;
    const key = this.slugify(dto.key || dto.name || existing.key);

    if (dto.defaultAccountKey) {
      await this.resolveFinanceAccount(dto.defaultAccountKey.trim());
    }

    await this.ensureUniqueRecord(this.expenseCategoryModel as unknown as Model<unknown>, name, key, id);

    await this.expenseCategoryModel.findByIdAndUpdate(id, {
      ...(dto.name !== undefined ? { name } : {}),
      ...(dto.key !== undefined || dto.name !== undefined ? { key } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || undefined } : {}),
      ...(dto.defaultAccountKey !== undefined ? { defaultAccountKey: dto.defaultAccountKey?.trim() || undefined } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    });

    const updated = await this.expenseCategoryModel.findById(id).lean();

    if (!updated) {
      throw new NotFoundException('Expense category not found');
    }

    await this.auditLogsService.record({
      entityType: 'expense_category',
      entityId: id,
      action: 'updated',
      summary: `Expense category ${updated.name} updated`,
      actor: currentUser,
      metadata: { name: updated.name, key: updated.key, defaultAccountKey: updated.defaultAccountKey },
    });

    return this.toExpenseCategoryResponse(updated as unknown as ExpenseCategory & { _id?: unknown });
  }

  async createOfferingEntry(dto: CreateOfferingEntryDto, currentUser: AuthUser) {
    this.ensureFinanceViewRole(currentUser);
    this.ensureOfferingEntryCreator(currentUser);

    const branch = await this.resolveScopedCreateBranch(currentUser);
    const serviceDate = this.validatePastOrTodayDate(dto.serviceDate, 'Service date');
    await this.ensurePeriodOpen(String(branch._id), serviceDate);

    const offeringType = await this.resolveOfferingType(dto.offeringTypeId);
    const serviceType = await this.resolveServiceType(String(branch._id), dto.serviceTypeId);
    const account = await this.resolveOfferingAccount(dto.accountId, offeringType.key);
    const serviceInstance = await this.serviceSchedulesService.resolveServiceInstanceForEntry({
      currentUser,
      branchId: String(branch._id),
      serviceDate,
      serviceScheduleId: dto.serviceScheduleId,
      serviceInstanceId: dto.serviceInstanceId,
    });

    const entry = await this.offeringEntryModel.create({
      branchId: branch._id,
      oversightRegion: branch.oversightRegion,
      district: branch.district,
      serviceDate,
      serviceScheduleId: serviceInstance?.serviceScheduleId ?? dto.serviceScheduleId,
      serviceInstanceId: serviceInstance?._id,
      serviceLabel: serviceInstance?.serviceScheduleName || serviceType.name,
      serviceTypeId: serviceType._id,
      serviceTypeKey: serviceType.key,
      serviceTypeLabel: serviceType.name,
      offeringTypeId: offeringType._id,
      offeringTypeKey: offeringType.key,
      offeringTypeLabel: offeringType.name,
      accountId: account._id,
      accountKey: account.key,
      accountLabel: account.name,
      amount: dto.amount,
      currency: dto.currency?.trim() || 'USD',
      notes: dto.notes?.trim() || undefined,
      createdBy: new Types.ObjectId(currentUser.sub),
      updatedBy: new Types.ObjectId(currentUser.sub),
    });

    await this.syncLedgerEntry({
      branchId: String(branch._id),
      oversightRegion: branch.oversightRegion,
      district: branch.district,
      entryDate: serviceDate,
      accountId: String(account._id),
      accountKey: account.key,
      accountLabel: account.name,
      direction: 'credit',
      sourceType: 'offering',
      sourceId: String(entry._id),
      serviceScheduleId: serviceInstance?.serviceScheduleId
        ? String(serviceInstance.serviceScheduleId)
        : dto.serviceScheduleId,
      serviceInstanceId: serviceInstance?._id ? String(serviceInstance._id) : undefined,
      serviceLabel: serviceInstance?.serviceScheduleName || serviceType.name,
      amount: dto.amount,
      currency: dto.currency?.trim() || 'USD',
      description: `${offeringType.name} offering`,
      status: 'approved',
      createdBy: currentUser.sub,
      updatedBy: currentUser.sub,
      approvedBy: currentUser.sub,
      reviewedAt: new Date(),
    });

    if (serviceInstance?._id) {
      await this.serviceSchedulesService.touchServiceInstance(String(serviceInstance._id), 'finance');
    }

    await this.auditLogsService.record({
      entityType: 'offering_entry',
      entityId: String(entry._id),
      action: 'created',
      summary: `${offeringType.name} offering recorded for ${branch.name}`,
      actor: currentUser,
      branchId: String(branch._id),
      metadata: {
        amount: dto.amount,
        currency: dto.currency?.trim() || 'USD',
        serviceType: serviceType.name,
        offeringType: offeringType.name,
        account: account.name,
        serviceDate,
      },
    });

    return this.findOfferingEntry(String(entry._id), currentUser);
  }

  async listOfferingEntries(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      oversightRegion?: string;
      district?: string;
      offeringTypeId?: string;
      accountId?: string;
      search?: string;
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    this.ensureFinanceViewRole(currentUser);

    const branches = await this.resolveVisibleBranches(currentUser, filters);
    const branchMatch = this.getBranchObjectIdMatch(branches);
    const safeLimit = Math.min(Math.max(filters.limit || 20, 1), 100);

    if (!branchMatch) {
      return {
        items: [],
        pagination: { page: 1, pageSize: safeLimit, total: 0, totalPages: 1 },
        summary: { totalAmount: 0, currentMonthTotal: 0, totalEntries: 0, visibleBranchCount: 0 },
        byType: [],
        byBranch: [],
      };
    }

    const requestedPage = Math.max(filters.page || 1, 1);
    const query: Record<string, unknown> = { branchId: branchMatch };
    const normalizedSearch = this.normalizeFilterValue(filters.search);

    if (filters.offeringTypeId) {
      query.offeringTypeId = new Types.ObjectId(filters.offeringTypeId);
    }

    if (filters.accountId) {
      query.accountId = new Types.ObjectId(filters.accountId);
    }

    if (normalizedSearch) {
      query.$or = [
        { offeringTypeLabel: { $regex: normalizedSearch, $options: 'i' } },
        { serviceTypeLabel: { $regex: normalizedSearch, $options: 'i' } },
        { serviceLabel: { $regex: normalizedSearch, $options: 'i' } },
        { notes: { $regex: normalizedSearch, $options: 'i' } },
      ];
    }

    const dateQuery: Record<string, unknown> = {};
    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      dateQuery.$gte = start;
      dateQuery.$lte = end;
    } else {
      if (filters.dateFrom) {
        const start = new Date(filters.dateFrom);
        start.setHours(0, 0, 0, 0);
        dateQuery.$gte = start;
      }

      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
    }

    if (Object.keys(dateQuery).length > 0) {
      query.serviceDate = dateQuery;
    }

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const nextMonthStart = new Date(currentMonthStart);
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

    const [total, amountAggregate, currentMonthAggregate, byTypeRaw, byBranchRaw] = await Promise.all([
      this.offeringEntryModel.countDocuments(query),
      this.offeringEntryModel.aggregate<{ totalAmount: number }>([
        { $match: query },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
      ]),
      this.offeringEntryModel.aggregate<{ totalAmount: number }>([
        {
          $match: {
            branchId: branchMatch,
            serviceDate: { $gte: currentMonthStart, $lt: nextMonthStart },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
      ]),
      this.offeringEntryModel.aggregate<{ _id: Types.ObjectId; label: string; totalAmount: number; entryCount: number }>([
        { $match: query },
        {
          $group: {
            _id: '$offeringTypeId',
            label: { $first: '$offeringTypeLabel' },
            totalAmount: { $sum: '$amount' },
            entryCount: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1, label: 1 } },
      ]),
      this.offeringEntryModel.aggregate<{ _id: Types.ObjectId; totalAmount: number; entryCount: number }>([
        { $match: query },
        {
          $group: {
            _id: '$branchId',
            totalAmount: { $sum: '$amount' },
            entryCount: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
    ]);

    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
    const safePage = Math.min(requestedPage, totalPages);
    const skip = (safePage - 1) * safeLimit;

    const items = await this.offeringEntryModel
      .find(query)
      .populate('branchId', 'name oversightRegion district')
      .populate('serviceTypeId', 'name key')
      .populate('serviceScheduleId', 'name dayOfWeek startTime')
      .populate('serviceInstanceId', 'serviceDateKey')
      .populate('offeringTypeId', 'name key isActive')
      .populate('accountId', 'name key')
      .populate('createdBy', 'firstName lastName email role')
      .populate('updatedBy', 'firstName lastName email role')
      .sort({ serviceDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const branchMap = new Map(branches.map((branch) => [String(branch._id), branch]));

    return {
      items: items.map((item) => this.toOfferingEntryResponse(item as unknown as Record<string, unknown>, currentUser)),
      pagination: { page: safePage, pageSize: safeLimit, total, totalPages },
      summary: {
        totalAmount: amountAggregate[0]?.totalAmount ?? 0,
        currentMonthTotal: currentMonthAggregate[0]?.totalAmount ?? 0,
        totalEntries: total,
        visibleBranchCount: branches.length,
      },
      byType: byTypeRaw.map((item) => ({
        offeringTypeId: String(item._id),
        label: item.label,
        totalAmount: item.totalAmount,
        entryCount: item.entryCount,
      })),
      byBranch: byBranchRaw.map((item) => {
        const branch = branchMap.get(String(item._id));
        return {
          branchId: String(item._id),
          name: branch?.name || 'Unknown branch',
          oversightRegion: branch?.oversightRegion,
          district: branch?.district,
          totalAmount: item.totalAmount,
          entryCount: item.entryCount,
        };
      }),
    };
  }

  async findOfferingEntry(id: string, currentUser: AuthUser) {
    this.ensureFinanceViewRole(currentUser);

    const entry = await this.offeringEntryModel
      .findById(id)
      .populate('branchId', 'name oversightRegion district')
      .populate('serviceTypeId', 'name key')
      .populate('serviceScheduleId', 'name dayOfWeek startTime')
      .populate('serviceInstanceId', 'serviceDateKey')
      .populate('offeringTypeId', 'name key isActive')
      .populate('accountId', 'name key')
      .populate('createdBy', 'firstName lastName email role')
      .populate('updatedBy', 'firstName lastName email role')
      .lean();

    if (!entry) {
      throw new NotFoundException('Offering entry not found');
    }

    const branchId =
      typeof entry.branchId === 'object' && entry.branchId !== null && '_id' in entry.branchId
        ? String((entry.branchId as { _id?: unknown })._id ?? '')
        : String(entry.branchId ?? '');

    await this.accessScopeService.ensureBranchAccess(currentUser, branchId);

    return this.toOfferingEntryResponse(entry as unknown as Record<string, unknown>, currentUser);
  }

  async updateOfferingEntry(id: string, dto: UpdateOfferingEntryDto, currentUser: AuthUser) {
    this.ensureFinanceViewRole(currentUser);

    const existing = (await this.offeringEntryModel.findById(id).lean()) as
      | (OfferingEntry & { _id?: unknown; createdAt?: Date; updatedAt?: Date })
      | null;

    if (!existing) {
      throw new NotFoundException('Offering entry not found');
    }

    await this.accessScopeService.ensureBranchAccess(currentUser, String(existing.branchId));

    const permission = this.getOfferingEditPermission(currentUser, {
      branchId: existing.branchId,
      serviceDate: existing.serviceDate,
      createdAt: existing.createdAt,
    });

    if (!permission.canEdit) {
      throw new ForbiddenException(permission.reason);
    }

    const serviceDate =
      dto.serviceDate !== undefined
        ? this.validatePastOrTodayDate(dto.serviceDate, 'Service date')
        : existing.serviceDate;
    await this.ensurePeriodOpen(String(existing.branchId), serviceDate);

    const serviceType = dto.serviceTypeId
      ? await this.resolveServiceType(String(existing.branchId), dto.serviceTypeId)
      : await this.resolveServiceType(String(existing.branchId), String(existing.serviceTypeId));
    const offeringType = dto.offeringTypeId
      ? await this.resolveOfferingType(dto.offeringTypeId)
      : await this.resolveOfferingType(String(existing.offeringTypeId));
    const account = await this.resolveOfferingAccount(dto.accountId, offeringType.key);
    const serviceInstance = await this.serviceSchedulesService.resolveServiceInstanceForEntry({
      currentUser,
      branchId: String(existing.branchId),
      serviceDate,
      serviceScheduleId: dto.serviceScheduleId,
      serviceInstanceId: dto.serviceInstanceId,
    });

    await this.offeringEntryModel.findByIdAndUpdate(id, {
      serviceDate,
      serviceScheduleId: serviceInstance?.serviceScheduleId ?? dto.serviceScheduleId ?? existing.serviceScheduleId,
      serviceInstanceId: serviceInstance?._id ?? existing.serviceInstanceId,
      serviceLabel: serviceInstance?.serviceScheduleName || existing.serviceLabel || serviceType.name,
      serviceTypeId: serviceType._id,
      serviceTypeKey: serviceType.key,
      serviceTypeLabel: serviceType.name,
      offeringTypeId: offeringType._id,
      offeringTypeKey: offeringType.key,
      offeringTypeLabel: offeringType.name,
      accountId: account._id,
      accountKey: account.key,
      accountLabel: account.name,
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency.trim() || 'USD' } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || undefined } : {}),
      updatedBy: new Types.ObjectId(currentUser.sub),
    });

    await this.syncLedgerEntry({
      branchId: String(existing.branchId),
      oversightRegion: existing.oversightRegion,
      district: existing.district,
      entryDate: serviceDate,
      accountId: String(account._id),
      accountKey: account.key,
      accountLabel: account.name,
      direction: 'credit',
      sourceType: 'offering',
      sourceId: id,
      serviceScheduleId: serviceInstance?.serviceScheduleId
        ? String(serviceInstance.serviceScheduleId)
        : dto.serviceScheduleId,
      serviceInstanceId: serviceInstance?._id ? String(serviceInstance._id) : dto.serviceInstanceId,
      serviceLabel: serviceInstance?.serviceScheduleName || existing.serviceLabel || serviceType.name,
      amount: dto.amount ?? existing.amount,
      currency: dto.currency?.trim() || existing.currency || 'USD',
      description: `${offeringType.name} offering`,
      status: 'approved',
      createdBy: String(existing.createdBy),
      updatedBy: currentUser.sub,
      approvedBy: currentUser.sub,
      reviewedAt: new Date(),
    });

    await this.auditLogsService.record({
      entityType: 'offering_entry',
      entityId: id,
      action: 'updated',
      summary: `Offering entry updated for ${existing.offeringTypeLabel}`,
      actor: currentUser,
      branchId: String(existing.branchId),
      metadata: {
        amount: dto.amount ?? existing.amount,
        currency: dto.currency ?? existing.currency,
        account: account.name,
        serviceDate,
      },
    });

    return this.findOfferingEntry(id, currentUser);
  }

  async createExpenseEntry(dto: CreateExpenseEntryDto, currentUser: AuthUser) {
    this.ensureFinanceViewRole(currentUser);
    this.ensureExpenseEntryCreator(currentUser);

    const branch = await this.resolveScopedCreateBranch(currentUser, dto.branchId);
    const expenseDate = this.validatePastOrTodayDate(dto.expenseDate, 'Expense date');
    await this.ensurePeriodOpen(String(branch._id), expenseDate);

    const account = await this.resolveFinanceAccount(dto.accountId);
    const category = await this.resolveExpenseCategory(dto.expenseCategoryId);
    const serviceInstance = await this.serviceSchedulesService.resolveServiceInstanceForEntry({
      currentUser,
      branchId: String(branch._id),
      serviceDate: expenseDate,
      serviceScheduleId: dto.serviceScheduleId,
      serviceInstanceId: dto.serviceInstanceId,
    });

    const autoApproved =
      isGlobalRole(currentUser.role) ||
      isNationalRole(currentUser.role) ||
      isDistrictRole(currentUser.role);
    const status = autoApproved ? 'approved' : 'submitted';

    const entry = await this.expenseEntryModel.create({
      branchId: branch._id,
      oversightRegion: branch.oversightRegion,
      district: branch.district,
      expenseDate,
      accountId: account._id,
      accountKey: account.key,
      accountLabel: account.name,
      expenseCategoryId: category._id,
      expenseCategoryKey: category.key,
      expenseCategoryLabel: category.name,
      serviceScheduleId: serviceInstance?.serviceScheduleId ?? dto.serviceScheduleId,
      serviceInstanceId: serviceInstance?._id,
      serviceLabel: serviceInstance?.serviceScheduleName,
      payee: dto.payee?.trim() || undefined,
      description: dto.description.trim(),
      amount: dto.amount,
      currency: dto.currency?.trim() || 'USD',
      receiptUrl: dto.receiptUrl?.trim() || undefined,
      notes: dto.notes?.trim() || undefined,
      status,
      createdBy: new Types.ObjectId(currentUser.sub),
      updatedBy: new Types.ObjectId(currentUser.sub),
      approvedBy: autoApproved ? new Types.ObjectId(currentUser.sub) : undefined,
      reviewedAt: autoApproved ? new Date() : undefined,
    });

    await this.syncLedgerEntry({
      branchId: String(branch._id),
      oversightRegion: branch.oversightRegion,
      district: branch.district,
      entryDate: expenseDate,
      accountId: String(account._id),
      accountKey: account.key,
      accountLabel: account.name,
      direction: 'debit',
      sourceType: 'expense',
      sourceId: String(entry._id),
      serviceScheduleId: serviceInstance?.serviceScheduleId
        ? String(serviceInstance.serviceScheduleId)
        : dto.serviceScheduleId,
      serviceInstanceId: serviceInstance?._id ? String(serviceInstance._id) : undefined,
      serviceLabel: serviceInstance?.serviceScheduleName,
      amount: dto.amount,
      currency: dto.currency?.trim() || 'USD',
      description: dto.description.trim(),
      status: status as 'approved' | 'submitted' | 'rejected' | 'locked',
      createdBy: currentUser.sub,
      updatedBy: currentUser.sub,
      approvedBy: autoApproved ? currentUser.sub : undefined,
      reviewedAt: autoApproved ? new Date() : undefined,
    });

    if (serviceInstance?._id) {
      await this.serviceSchedulesService.touchServiceInstance(String(serviceInstance._id), 'finance');
    }

    await this.auditLogsService.record({
      entityType: 'expense_entry',
      entityId: String(entry._id),
      action: 'created',
      summary: `${category.name} expense submitted for ${branch.name}`,
      actor: currentUser,
      branchId: String(branch._id),
      metadata: {
        amount: dto.amount,
        currency: dto.currency?.trim() || 'USD',
        account: account.name,
        category: category.name,
        status,
      },
    });

    return this.findExpenseEntry(String(entry._id), currentUser);
  }

  async listExpenseEntries(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      oversightRegion?: string;
      district?: string;
      expenseCategoryId?: string;
      accountId?: string;
      status?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    this.ensureFinanceViewRole(currentUser);

    const branches = await this.resolveVisibleBranches(currentUser, filters);
    const branchMatch = this.getBranchObjectIdMatch(branches);
    const safeLimit = Math.min(Math.max(filters.limit || 20, 1), 100);

    if (!branchMatch) {
      return {
        items: [],
        pagination: { page: 1, pageSize: safeLimit, total: 0, totalPages: 1 },
        summary: {
          totalAmount: 0,
          pendingAmount: 0,
          pendingCount: 0,
          visibleBranchCount: 0,
        },
      };
    }

    const requestedPage = Math.max(filters.page || 1, 1);
    const query: Record<string, unknown> = { branchId: branchMatch };

    if (filters.expenseCategoryId) {
      query.expenseCategoryId = new Types.ObjectId(filters.expenseCategoryId);
    }

    if (filters.accountId) {
      query.accountId = new Types.ObjectId(filters.accountId);
    }

    if (filters.status) {
      query.status = filters.status;
    }

    const normalizedSearch = this.normalizeFilterValue(filters.search);
    if (normalizedSearch) {
      query.$or = [
        { description: { $regex: normalizedSearch, $options: 'i' } },
        { payee: { $regex: normalizedSearch, $options: 'i' } },
        { expenseCategoryLabel: { $regex: normalizedSearch, $options: 'i' } },
        { accountLabel: { $regex: normalizedSearch, $options: 'i' } },
        { notes: { $regex: normalizedSearch, $options: 'i' } },
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      query.expenseDate = {
        ...(filters.dateFrom ? { $gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { $lte: new Date(filters.dateTo) } : {}),
      };
    }

    const [total, totalAggregate, pendingAggregate, pendingCount] = await Promise.all([
      this.expenseEntryModel.countDocuments(query),
      this.expenseEntryModel.aggregate<{ totalAmount: number }>([
        { $match: query },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
      ]),
      this.expenseEntryModel.aggregate<{ totalAmount: number }>([
        { $match: { ...query, status: 'submitted' } },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
      ]),
      this.expenseEntryModel.countDocuments({ ...query, status: 'submitted' }),
    ]);

    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
    const safePage = Math.min(requestedPage, totalPages);
    const skip = (safePage - 1) * safeLimit;

    const items = await this.expenseEntryModel
      .find(query)
      .populate('branchId', 'name oversightRegion district')
      .populate('accountId', 'name key')
      .populate('expenseCategoryId', 'name key')
      .populate('serviceScheduleId', 'name')
      .populate('serviceInstanceId', 'serviceDateKey')
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();

    return {
      items: items.map((item) => this.toExpenseEntryResponse(item as unknown as Record<string, unknown>, currentUser)),
      pagination: { page: safePage, pageSize: safeLimit, total, totalPages },
      summary: {
        totalAmount: totalAggregate[0]?.totalAmount ?? 0,
        pendingAmount: pendingAggregate[0]?.totalAmount ?? 0,
        pendingCount,
        visibleBranchCount: branches.length,
      },
    };
  }

  async findExpenseEntry(id: string, currentUser: AuthUser) {
    this.ensureFinanceViewRole(currentUser);

    const entry = await this.expenseEntryModel
      .findById(id)
      .populate('branchId', 'name oversightRegion district')
      .populate('accountId', 'name key')
      .populate('expenseCategoryId', 'name key')
      .populate('serviceScheduleId', 'name')
      .populate('serviceInstanceId', 'serviceDateKey')
      .lean();

    if (!entry) {
      throw new NotFoundException('Expense entry not found');
    }

    const branchId =
      typeof entry.branchId === 'object' && entry.branchId !== null && '_id' in entry.branchId
        ? String((entry.branchId as { _id?: unknown })._id ?? '')
        : String(entry.branchId ?? '');

    await this.accessScopeService.ensureBranchAccess(currentUser, branchId);

    return this.toExpenseEntryResponse(entry as unknown as Record<string, unknown>, currentUser);
  }

  async updateExpenseEntry(id: string, dto: UpdateExpenseEntryDto, currentUser: AuthUser) {
    this.ensureFinanceViewRole(currentUser);

    const existing = (await this.expenseEntryModel.findById(id).lean()) as
      | (ExpenseEntry & { _id?: unknown; createdAt?: Date })
      | null;

    if (!existing) {
      throw new NotFoundException('Expense entry not found');
    }

    await this.accessScopeService.ensureBranchAccess(currentUser, String(existing.branchId));
    const permission = this.getExpenseEditPermission(currentUser, {
      expenseDate: existing.expenseDate,
      createdAt: existing.createdAt,
      status: existing.status,
    });

    if (!permission.canEdit) {
      throw new ForbiddenException(permission.reason);
    }

    const expenseDate =
      dto.expenseDate !== undefined
        ? this.validatePastOrTodayDate(dto.expenseDate, 'Expense date')
        : existing.expenseDate;
    await this.ensurePeriodOpen(String(existing.branchId), expenseDate);

    const account = dto.accountId
      ? await this.resolveFinanceAccount(dto.accountId)
      : await this.resolveFinanceAccount(String(existing.accountId));
    const category = dto.expenseCategoryId
      ? await this.resolveExpenseCategory(dto.expenseCategoryId)
      : await this.resolveExpenseCategory(String(existing.expenseCategoryId));
    const serviceInstance = await this.serviceSchedulesService.resolveServiceInstanceForEntry({
      currentUser,
      branchId: String(existing.branchId),
      serviceDate: expenseDate,
      serviceScheduleId: dto.serviceScheduleId,
      serviceInstanceId: dto.serviceInstanceId,
    });

    const nextStatus =
      ['branch_admin', 'resident_pastor', 'associate_pastor'].includes(currentUser.role) &&
      (dto.amount !== undefined ||
        dto.accountId !== undefined ||
        dto.expenseCategoryId !== undefined ||
        dto.expenseDate !== undefined ||
        dto.description !== undefined)
        ? 'submitted'
        : existing.status;

    await this.expenseEntryModel.findByIdAndUpdate(id, {
      expenseDate,
      accountId: account._id,
      accountKey: account.key,
      accountLabel: account.name,
      expenseCategoryId: category._id,
      expenseCategoryKey: category.key,
      expenseCategoryLabel: category.name,
      serviceScheduleId: serviceInstance?.serviceScheduleId ?? dto.serviceScheduleId ?? existing.serviceScheduleId,
      serviceInstanceId: serviceInstance?._id ?? existing.serviceInstanceId,
      serviceLabel: serviceInstance?.serviceScheduleName ?? existing.serviceLabel,
      ...(dto.payee !== undefined ? { payee: dto.payee?.trim() || undefined } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency.trim() || 'USD' } : {}),
      ...(dto.receiptUrl !== undefined ? { receiptUrl: dto.receiptUrl?.trim() || undefined } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || undefined } : {}),
      status: nextStatus,
      updatedBy: new Types.ObjectId(currentUser.sub),
      ...(nextStatus === 'submitted' ? { approvedBy: undefined, reviewedAt: undefined, reviewNotes: undefined } : {}),
    });

    await this.syncLedgerEntry({
      branchId: String(existing.branchId),
      oversightRegion: existing.oversightRegion,
      district: existing.district,
      entryDate: expenseDate,
      accountId: String(account._id),
      accountKey: account.key,
      accountLabel: account.name,
      direction: 'debit',
      sourceType: 'expense',
      sourceId: id,
      serviceScheduleId: serviceInstance?.serviceScheduleId
        ? String(serviceInstance.serviceScheduleId)
        : dto.serviceScheduleId,
      serviceInstanceId: serviceInstance?._id ? String(serviceInstance._id) : dto.serviceInstanceId,
      serviceLabel: serviceInstance?.serviceScheduleName ?? existing.serviceLabel,
      amount: dto.amount ?? existing.amount,
      currency: dto.currency?.trim() || existing.currency || 'USD',
      description: dto.description?.trim() || existing.description,
      status: nextStatus as 'approved' | 'submitted' | 'rejected' | 'locked',
      createdBy: String(existing.createdBy),
      updatedBy: currentUser.sub,
      approvedBy: nextStatus === 'approved' ? currentUser.sub : undefined,
      reviewedAt: nextStatus === 'approved' ? new Date() : undefined,
    });

    await this.auditLogsService.record({
      entityType: 'expense_entry',
      entityId: id,
      action: 'updated',
      summary: `${category.name} expense updated`,
      actor: currentUser,
      branchId: String(existing.branchId),
      metadata: {
        amount: dto.amount ?? existing.amount,
        account: account.name,
        category: category.name,
        status: nextStatus,
      },
    });

    return this.findExpenseEntry(id, currentUser);
  }

  async approveExpenseEntry(id: string, dto: ReviewExpenseEntryDto, currentUser: AuthUser) {
    this.ensureFinanceViewRole(currentUser);
    this.ensureExpenseApprover(currentUser);

    const existing = await this.expenseEntryModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Expense entry not found');
    }

    await this.accessScopeService.ensureBranchAccess(currentUser, String(existing.branchId));

    await this.expenseEntryModel.findByIdAndUpdate(id, {
      status: 'approved',
      approvedBy: new Types.ObjectId(currentUser.sub),
      reviewedAt: new Date(),
      reviewNotes: dto.notes?.trim() || undefined,
      updatedBy: new Types.ObjectId(currentUser.sub),
    });

    await this.syncLedgerEntry({
      branchId: String(existing.branchId),
      oversightRegion: existing.oversightRegion,
      district: existing.district,
      entryDate: existing.expenseDate,
      accountId: String(existing.accountId),
      accountKey: existing.accountKey,
      accountLabel: existing.accountLabel,
      direction: 'debit',
      sourceType: 'expense',
      sourceId: id,
      serviceScheduleId: existing.serviceScheduleId ? String(existing.serviceScheduleId) : undefined,
      serviceInstanceId: existing.serviceInstanceId ? String(existing.serviceInstanceId) : undefined,
      serviceLabel: existing.serviceLabel,
      amount: existing.amount,
      currency: existing.currency,
      description: existing.description,
      status: 'approved',
      createdBy: String(existing.createdBy),
      updatedBy: currentUser.sub,
      approvedBy: currentUser.sub,
      reviewedAt: new Date(),
    });

    await this.auditLogsService.record({
      entityType: 'expense_entry',
      entityId: id,
      action: 'approved',
      summary: `${existing.expenseCategoryLabel} expense approved`,
      actor: currentUser,
      branchId: String(existing.branchId),
      metadata: {
        amount: existing.amount,
        reviewNotes: dto.notes?.trim() || undefined,
      },
    });

    return this.findExpenseEntry(id, currentUser);
  }

  async rejectExpenseEntry(id: string, dto: ReviewExpenseEntryDto, currentUser: AuthUser) {
    this.ensureFinanceViewRole(currentUser);
    this.ensureExpenseApprover(currentUser);

    const existing = await this.expenseEntryModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Expense entry not found');
    }

    await this.accessScopeService.ensureBranchAccess(currentUser, String(existing.branchId));

    await this.expenseEntryModel.findByIdAndUpdate(id, {
      status: 'rejected',
      approvedBy: new Types.ObjectId(currentUser.sub),
      reviewedAt: new Date(),
      reviewNotes: dto.notes?.trim() || undefined,
      updatedBy: new Types.ObjectId(currentUser.sub),
    });

    await this.syncLedgerEntry({
      branchId: String(existing.branchId),
      oversightRegion: existing.oversightRegion,
      district: existing.district,
      entryDate: existing.expenseDate,
      accountId: String(existing.accountId),
      accountKey: existing.accountKey,
      accountLabel: existing.accountLabel,
      direction: 'debit',
      sourceType: 'expense',
      sourceId: id,
      serviceScheduleId: existing.serviceScheduleId ? String(existing.serviceScheduleId) : undefined,
      serviceInstanceId: existing.serviceInstanceId ? String(existing.serviceInstanceId) : undefined,
      serviceLabel: existing.serviceLabel,
      amount: existing.amount,
      currency: existing.currency,
      description: existing.description,
      status: 'rejected',
      createdBy: String(existing.createdBy),
      updatedBy: currentUser.sub,
      approvedBy: currentUser.sub,
      reviewedAt: new Date(),
    });

    await this.auditLogsService.record({
      entityType: 'expense_entry',
      entityId: id,
      action: 'rejected',
      summary: `${existing.expenseCategoryLabel} expense rejected`,
      actor: currentUser,
      branchId: String(existing.branchId),
      metadata: {
        amount: existing.amount,
        reviewNotes: dto.notes?.trim() || undefined,
      },
    });

    return this.findExpenseEntry(id, currentUser);
  }

  async listLedger(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      oversightRegion?: string;
      district?: string;
      accountId?: string;
      sourceType?: string;
      status?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    this.ensureFinanceViewRole(currentUser);

    const branches = await this.resolveVisibleBranches(currentUser, filters);
    const branchMatch = this.getBranchObjectIdMatch(branches);
    const safeLimit = Math.min(Math.max(filters.limit || 20, 1), 100);

    if (!branchMatch) {
      return {
        items: [],
        pagination: { page: 1, pageSize: safeLimit, total: 0, totalPages: 1 },
        summary: {
          totalCredits: 0,
          totalDebits: 0,
          netBalance: 0,
          pendingExpenseApprovals: 0,
          lockedPeriods: 0,
        },
        byAccount: [],
        byBranch: [],
      };
    }

    const requestedPage = Math.max(filters.page || 1, 1);
    const query: Record<string, unknown> = { branchId: branchMatch };

    if (filters.accountId) {
      query.accountId = new Types.ObjectId(filters.accountId);
    }

    if (filters.sourceType) {
      query.sourceType = filters.sourceType;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    const normalizedSearch = this.normalizeFilterValue(filters.search);
    if (normalizedSearch) {
      query.$or = [
        { description: { $regex: normalizedSearch, $options: 'i' } },
        { accountLabel: { $regex: normalizedSearch, $options: 'i' } },
        { serviceLabel: { $regex: normalizedSearch, $options: 'i' } },
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      query.entryDate = {
        ...(filters.dateFrom ? { $gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { $lte: new Date(filters.dateTo) } : {}),
      };
    }

    const [total, aggregate, byAccountRaw, byBranchRaw, pendingApprovals, lockedPeriods] =
      await Promise.all([
        this.ledgerEntryModel.countDocuments(query),
        this.ledgerEntryModel.aggregate<{ _id: string; total: number }>([
          { $match: query },
          { $group: { _id: '$direction', total: { $sum: '$amount' } } },
        ]),
        this.ledgerEntryModel.aggregate<{ _id: Types.ObjectId; label: string; direction: string; totalAmount: number }>([
          { $match: { ...query, status: { $ne: 'rejected' } } },
          {
            $group: {
              _id: '$accountId',
              label: { $first: '$accountLabel' },
              totalCredits: {
                $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0] },
              },
              totalDebits: {
                $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0] },
              },
            },
          },
        ]),
        this.ledgerEntryModel.aggregate<{ _id: Types.ObjectId; totalCredits: number; totalDebits: number }>([
          { $match: { ...query, status: { $ne: 'rejected' } } },
          {
            $group: {
              _id: '$branchId',
              totalCredits: {
                $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0] },
              },
              totalDebits: {
                $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0] },
              },
            },
          },
        ]),
        this.expenseEntryModel.countDocuments({
          branchId: branchMatch,
          status: 'submitted',
        }),
        this.financeLockModel.countDocuments({ branchId: branchMatch }),
      ]);

    const totalCredits = aggregate.find((item) => item._id === 'credit')?.total ?? 0;
    const totalDebits = aggregate.find((item) => item._id === 'debit')?.total ?? 0;
    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
    const safePage = Math.min(requestedPage, totalPages);
    const skip = (safePage - 1) * safeLimit;

    const items = await this.ledgerEntryModel
      .find(query)
      .populate('branchId', 'name oversightRegion district')
      .populate('accountId', 'name key')
      .sort({ entryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const branchMap = new Map(branches.map((branch) => [String(branch._id), branch]));

    return {
      items: items.map((item) => this.toLedgerEntryResponse(item as unknown as Record<string, unknown>)),
      pagination: { page: safePage, pageSize: safeLimit, total, totalPages },
      summary: {
        totalCredits,
        totalDebits,
        netBalance: totalCredits - totalDebits,
        pendingExpenseApprovals: pendingApprovals,
        lockedPeriods,
      },
      byAccount: byAccountRaw.map((item) => ({
        accountId: String(item._id),
        label: item.label,
        totalCredits: (item as unknown as { totalCredits?: number }).totalCredits ?? 0,
        totalDebits: (item as unknown as { totalDebits?: number }).totalDebits ?? 0,
        balance:
          ((item as unknown as { totalCredits?: number }).totalCredits ?? 0) -
          ((item as unknown as { totalDebits?: number }).totalDebits ?? 0),
      })),
      byBranch: byBranchRaw.map((item) => {
        const branch = branchMap.get(String(item._id));
        return {
          branchId: String(item._id),
          name: branch?.name || 'Unknown branch',
          oversightRegion: branch?.oversightRegion,
          district: branch?.district,
          totalCredits: item.totalCredits,
          totalDebits: item.totalDebits,
          balance: item.totalCredits - item.totalDebits,
        };
      }),
    };
  }

  async listFinanceLocks(
    currentUser: AuthUser,
    filters: { branchId?: string; oversightRegion?: string; district?: string } = {},
  ) {
    this.ensureFinanceViewRole(currentUser);

    const branches = await this.resolveVisibleBranches(currentUser, filters);
    const branchMatch = this.getBranchObjectIdMatch(branches);

    if (!branchMatch) {
      return [];
    }

    const locks = await this.financeLockModel
      .find({ branchId: branchMatch })
      .populate('branchId', 'name oversightRegion district')
      .populate('lockedBy', 'firstName lastName email role')
      .sort({ periodKey: -1 })
      .lean();

    return locks.map((lock) => ({
      _id: String(lock._id),
      branchId:
        typeof lock.branchId === 'object' && lock.branchId !== null
          ? {
              _id: String((lock.branchId as { _id?: unknown })._id ?? ''),
              name: (lock.branchId as { name?: string }).name,
              oversightRegion: (lock.branchId as { oversightRegion?: string }).oversightRegion,
              district: (lock.branchId as { district?: string }).district,
            }
          : lock.branchId,
      periodKey: lock.periodKey,
      reason: lock.reason,
      lockedAt: lock.lockedAt,
      lockedBy:
        typeof lock.lockedBy === 'object' && lock.lockedBy !== null
          ? {
              _id: String((lock.lockedBy as { _id?: unknown })._id ?? ''),
              firstName: (lock.lockedBy as { firstName?: string }).firstName,
              lastName: (lock.lockedBy as { lastName?: string }).lastName,
              email: (lock.lockedBy as { email?: string }).email,
              role: (lock.lockedBy as { role?: string }).role,
            }
          : undefined,
    }));
  }

  async createFinanceLock(dto: CreateFinanceLockDto, currentUser: AuthUser) {
    this.ensureFinanceLockManager(currentUser);
    const branch = await this.resolveScopedCreateBranch(currentUser, dto.branchId);

    if (!/^\d{4}-\d{2}$/.test(dto.periodKey.trim())) {
      throw new BadRequestException('Finance lock period must use YYYY-MM format');
    }

    const existing = await this.financeLockModel.findOne({
      branchId: branch._id,
      periodKey: dto.periodKey.trim(),
    }).lean();

    if (existing) {
      throw new BadRequestException('This branch period is already locked');
    }

    const lock = await this.financeLockModel.create({
      branchId: branch._id,
      oversightRegion: branch.oversightRegion,
      district: branch.district,
      periodKey: dto.periodKey.trim(),
      reason: dto.reason?.trim() || undefined,
      lockedBy: new Types.ObjectId(currentUser.sub),
      lockedAt: new Date(),
    });

    await this.applyLockStateToPeriod(String(branch._id), dto.periodKey.trim(), true);

    await this.auditLogsService.record({
      entityType: 'finance_lock',
      entityId: String(lock._id),
      action: 'created',
      summary: `Finance period ${dto.periodKey.trim()} locked for ${branch.name}`,
      actor: currentUser,
      branchId: String(branch._id),
      metadata: { periodKey: dto.periodKey.trim(), reason: dto.reason?.trim() || undefined },
    });

    return {
      _id: String(lock._id),
      branchId: String(branch._id),
      periodKey: lock.periodKey,
      reason: lock.reason,
      lockedAt: lock.lockedAt,
    };
  }

  async removeFinanceLock(id: string, currentUser: AuthUser) {
    this.ensureFinanceLockManager(currentUser);

    const existing = await this.financeLockModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Finance lock not found');
    }

    await this.accessScopeService.ensureBranchAccess(currentUser, String(existing.branchId));
    await this.financeLockModel.findByIdAndDelete(id);
    await this.applyLockStateToPeriod(String(existing.branchId), existing.periodKey, false);

    await this.auditLogsService.record({
      entityType: 'finance_lock',
      entityId: id,
      action: 'deleted',
      summary: `Finance period ${existing.periodKey} unlocked`,
      actor: currentUser,
      branchId: String(existing.branchId),
      metadata: { periodKey: existing.periodKey },
    });

    return { success: true };
  }
}
