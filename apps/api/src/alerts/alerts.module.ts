import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { ExpenseEntry, ExpenseEntrySchema } from '../finance/schemas/expense-entry.schema';
import { FollowUp, FollowUpSchema } from '../follow-ups/schemas/follow-up.schema';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import {
  IntakeSubmission,
  IntakeSubmissionSchema,
} from '../intake-templates/schemas/intake-submission.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  WorkspaceRequest,
  WorkspaceRequestSchema,
} from '../workspace-requests/schemas/workspace-request.schema';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: FollowUp.name, schema: FollowUpSchema },
      { name: Guest.name, schema: GuestSchema },
      { name: IntakeSubmission.name, schema: IntakeSubmissionSchema },
      { name: ExpenseEntry.name, schema: ExpenseEntrySchema },
      { name: WorkspaceRequest.name, schema: WorkspaceRequestSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
