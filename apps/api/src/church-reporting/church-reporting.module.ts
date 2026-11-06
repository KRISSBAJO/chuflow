import { Module } from '@nestjs/common';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { FinanceModule } from '../finance/finance.module';
import { ChurchReportingController } from './church-reporting.controller';
import { ChurchReportingService } from './church-reporting.service';

@Module({
  imports: [AccessScopeModule, AttendanceModule, FinanceModule],
  controllers: [ChurchReportingController],
  providers: [ChurchReportingService],
})
export class ChurchReportingModule {}
