import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import {
  ServiceUnit,
  ServiceUnitSchema,
} from '../service-units/schemas/service-unit.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import {
  ImportBatch,
  ImportBatchSchema,
  ImportRow,
  ImportRowSchema,
  ImportLock,
  ImportLockSchema,
} from './import.schema';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
@Module({
  imports: [
    AccessScopeModule,
    AuditLogsModule,
    MongooseModule.forFeature([
      { name: Guest.name, schema: GuestSchema },
      { name: Member.name, schema: MemberSchema },
      { name: ServiceUnit.name, schema: ServiceUnitSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: ImportBatch.name, schema: ImportBatchSchema },
      { name: ImportRow.name, schema: ImportRowSchema },
      { name: ImportLock.name, schema: ImportLockSchema },
    ]),
  ],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
