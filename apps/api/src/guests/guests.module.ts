import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import {
  Attendance,
  AttendanceSchema,
} from '../attendance/schemas/attendance.schema';
import {
  Communication,
  CommunicationSchema,
} from '../communications/schemas/communication.schema';
import {
  FollowUp,
  FollowUpSchema,
} from '../follow-ups/schemas/follow-up.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { PushModule } from '../push/push.module';
import { VisitsModule } from '../visits/visits.module';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { Guest, GuestSchema } from './schemas/guest.schema';
import { GuestFieldsService } from './guest-fields.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AppSetting, AppSettingSchema } from '../settings/schemas/app-setting.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PrayerCareService } from './prayer-care.service';
import { PrayerCareController } from './prayer-care.controller';

@Module({
  imports: [
    AccessScopeModule,
    AuditLogsModule,
    MongooseModule.forFeature([
      { name: AppSetting.name, schema: AppSettingSchema },
      { name: User.name, schema: UserSchema },
      { name: Guest.name, schema: GuestSchema },
      { name: Visit.name, schema: VisitSchema },
      { name: FollowUp.name, schema: FollowUpSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Communication.name, schema: CommunicationSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    VisitsModule,
    FollowUpsModule,
    PushModule,
  ],
  controllers: [PrayerCareController, GuestsController],
  providers: [GuestsService, GuestFieldsService, PrayerCareService],
  exports: [GuestsService, GuestFieldsService, PrayerCareService, MongooseModule],
})
export class GuestsModule {}
