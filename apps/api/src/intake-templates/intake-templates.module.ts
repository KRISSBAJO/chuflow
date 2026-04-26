import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { GuestsModule } from '../guests/guests.module';
import { MembersModule } from '../members/members.module';
import { ServiceTypesModule } from '../service-types/service-types.module';
import { ServiceUnitsModule } from '../service-units/service-units.module';
import { IntakeTemplatesController } from './intake-templates.controller';
import { IntakeTemplatesService } from './intake-templates.service';
import { IntakeSubmission, IntakeSubmissionSchema } from './schemas/intake-submission.schema';
import { IntakeTemplate, IntakeTemplateSchema } from './schemas/intake-template.schema';

@Module({
  imports: [
    ConfigModule,
    AccessScopeModule,
    AuditLogsModule,
    GuestsModule,
    MembersModule,
    AttendanceModule,
    ServiceTypesModule,
    ServiceUnitsModule,
    MongooseModule.forFeature([
      { name: IntakeTemplate.name, schema: IntakeTemplateSchema },
      { name: IntakeSubmission.name, schema: IntakeSubmissionSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [IntakeTemplatesController],
  providers: [IntakeTemplatesService],
})
export class IntakeTemplatesModule {}
