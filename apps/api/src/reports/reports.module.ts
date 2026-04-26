import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { FollowUp, FollowUpSchema } from '../follow-ups/schemas/follow-up.schema';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: Guest.name, schema: GuestSchema },
      { name: FollowUp.name, schema: FollowUpSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
