import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { ServiceSchedulesModule } from '../service-schedules/service-schedules.module';
import { ServiceTypesModule } from '../service-types/service-types.module';
import { ServiceInstance, ServiceInstanceSchema } from '../service-schedules/schemas/service-instance.schema';
import { ServiceSchedule, ServiceScheduleSchema } from '../service-schedules/schemas/service-schedule.schema';
import { ServiceType, ServiceTypeSchema } from '../service-types/schemas/service-type.schema';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { Attendance, AttendanceSchema } from './schemas/attendance.schema';

@Module({
  imports: [
    AccessScopeModule,
    AuditLogsModule,
    ServiceSchedulesModule,
    ServiceTypesModule,
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Guest.name, schema: GuestSchema },
      { name: Member.name, schema: MemberSchema },
      { name: ServiceType.name, schema: ServiceTypeSchema },
      { name: ServiceSchedule.name, schema: ServiceScheduleSchema },
      { name: ServiceInstance.name, schema: ServiceInstanceSchema },
    ]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService, MongooseModule],
})
export class AttendanceModule {}
