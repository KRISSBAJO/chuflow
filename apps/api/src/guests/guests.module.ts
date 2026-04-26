import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Communication, CommunicationSchema } from '../communications/schemas/communication.schema';
import { FollowUp, FollowUpSchema } from '../follow-ups/schemas/follow-up.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { VisitsModule } from '../visits/visits.module';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { Guest, GuestSchema } from './schemas/guest.schema';

@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: Guest.name, schema: GuestSchema },
      { name: Visit.name, schema: VisitSchema },
      { name: FollowUp.name, schema: FollowUpSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Communication.name, schema: CommunicationSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    VisitsModule,
    FollowUpsModule,
  ],
  controllers: [GuestsController],
  providers: [GuestsService],
  exports: [GuestsService, MongooseModule],
})
export class GuestsModule {}
