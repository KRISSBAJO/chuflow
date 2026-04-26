import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { ServiceType, ServiceTypeSchema } from '../service-types/schemas/service-type.schema';
import { ServiceInstance, ServiceInstanceSchema } from './schemas/service-instance.schema';
import { ServiceSchedule, ServiceScheduleSchema } from './schemas/service-schedule.schema';
import { ServiceSchedulesController } from './service-schedules.controller';
import { ServiceSchedulesService } from './service-schedules.service';

@Module({
  imports: [
    AccessScopeModule,
    AuditLogsModule,
    MongooseModule.forFeature([
      { name: ServiceSchedule.name, schema: ServiceScheduleSchema },
      { name: ServiceInstance.name, schema: ServiceInstanceSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: ServiceType.name, schema: ServiceTypeSchema },
    ]),
  ],
  controllers: [ServiceSchedulesController],
  providers: [ServiceSchedulesService],
  exports: [ServiceSchedulesService, MongooseModule],
})
export class ServiceSchedulesModule {}
