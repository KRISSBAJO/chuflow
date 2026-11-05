import {
  Communication,
  CommunicationSchema,
} from '../communications/schemas/communication.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import {
  Attendance,
  AttendanceSchema,
} from '../attendance/schemas/attendance.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import {
  FollowUp,
  FollowUpSchema,
} from '../follow-ups/schemas/follow-up.schema';
import {
  OutreachContact,
  OutreachContactSchema,
} from '../evangelism/evangelism.schema';
import {
  ServiceUnit,
  ServiceUnitSchema,
} from '../service-units/schemas/service-unit.schema';
import {
  CareCase,
  CareCaseSchema,
  CareTask,
  CareTaskSchema,
  CareEvent,
  CareEventSchema,
  CarePlan,
  CarePlanSchema,
  CareJob,
  CareJobSchema,
  CareToken,
  CareTokenSchema,
  CareState,
  CareStateSchema,
} from './care.schema';
import { CareService } from './care.service';
import { CareWorker } from './care.worker';
import { CareController } from './care.controller';
@Module({
  imports: [
    AccessScopeModule,
    MailModule,
    PushModule,
    MongooseModule.forFeature([
      { name: Communication.name, schema: CommunicationSchema },
      { name: User.name, schema: UserSchema },
      { name: Guest.name, schema: GuestSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Visit.name, schema: VisitSchema },
      { name: FollowUp.name, schema: FollowUpSchema },
      { name: OutreachContact.name, schema: OutreachContactSchema },
      { name: ServiceUnit.name, schema: ServiceUnitSchema },
      { name: CareCase.name, schema: CareCaseSchema },
      { name: CareTask.name, schema: CareTaskSchema },
      { name: CareEvent.name, schema: CareEventSchema },
      { name: CarePlan.name, schema: CarePlanSchema },
      { name: CareJob.name, schema: CareJobSchema },
      { name: CareToken.name, schema: CareTokenSchema },
      { name: CareState.name, schema: CareStateSchema },
    ]),
  ],
  controllers: [CareController],
  providers: [CareService, CareWorker],
  exports: [CareService],
})
export class CareModule {}
