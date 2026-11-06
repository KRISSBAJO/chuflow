import { WeeklyWorkflowController } from './weekly-workflow.controller';
import { WeeklyWorkflowService } from './weekly-workflow.service';
import { WeeklyDistrictPacket, WeeklyDistrictPacketSchema } from './weekly-workflow.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { GuestsModule } from '../guests/guests.module';
import { MembersModule } from '../members/members.module';
import { PushModule } from '../push/push.module';
import { ServiceTypesModule } from '../service-types/service-types.module';
import { ServiceUnitsModule } from '../service-units/service-units.module';
import { IntakeTemplatesController } from './intake-templates.controller';
import { IntakeTemplatesService } from './intake-templates.service';
import {
  IntakeSubmission,
  IntakeSubmissionSchema,
} from './schemas/intake-submission.schema';
import {
  IntakeTemplate,
  IntakeTemplateSchema,
} from './schemas/intake-template.schema';

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
    PushModule,
    MongooseModule.forFeature([
      { name: IntakeTemplate.name, schema: IntakeTemplateSchema },
      { name: IntakeSubmission.name, schema: IntakeSubmissionSchema },
      { name: Branch.name, schema: BranchSchema },
      {name:User.name,schema:UserSchema},
      {name:WeeklyDistrictPacket.name,schema:WeeklyDistrictPacketSchema},
    ]),
  ],
  controllers: [IntakeTemplatesController, WeeklyWorkflowController],
  providers: [IntakeTemplatesService, WeeklyWorkflowService],
})
export class IntakeTemplatesModule {}
