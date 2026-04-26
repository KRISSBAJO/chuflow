import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { ServiceSchedulesModule } from '../service-schedules/service-schedules.module';
import { ServiceType, ServiceTypeSchema } from '../service-types/schemas/service-type.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { ExpenseCategory, ExpenseCategorySchema } from './schemas/expense-category.schema';
import { ExpenseEntry, ExpenseEntrySchema } from './schemas/expense-entry.schema';
import { FinanceAccount, FinanceAccountSchema } from './schemas/finance-account.schema';
import { FinanceLedgerEntry, FinanceLedgerEntrySchema } from './schemas/finance-ledger-entry.schema';
import { FinanceLock, FinanceLockSchema } from './schemas/finance-lock.schema';
import { OfferingEntry, OfferingEntrySchema } from './schemas/offering-entry.schema';
import { OfferingType, OfferingTypeSchema } from './schemas/offering-type.schema';
import { ServiceInstance, ServiceInstanceSchema } from '../service-schedules/schemas/service-instance.schema';
import { ServiceSchedule, ServiceScheduleSchema } from '../service-schedules/schemas/service-schedule.schema';

@Module({
  imports: [
    AccessScopeModule,
    AuditLogsModule,
    ServiceSchedulesModule,
    MongooseModule.forFeature([
      { name: OfferingType.name, schema: OfferingTypeSchema },
      { name: OfferingEntry.name, schema: OfferingEntrySchema },
      { name: FinanceAccount.name, schema: FinanceAccountSchema },
      { name: ExpenseCategory.name, schema: ExpenseCategorySchema },
      { name: ExpenseEntry.name, schema: ExpenseEntrySchema },
      { name: FinanceLedgerEntry.name, schema: FinanceLedgerEntrySchema },
      { name: FinanceLock.name, schema: FinanceLockSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: ServiceType.name, schema: ServiceTypeSchema },
      { name: ServiceSchedule.name, schema: ServiceScheduleSchema },
      { name: ServiceInstance.name, schema: ServiceInstanceSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService, MongooseModule],
})
export class FinanceModule {}
