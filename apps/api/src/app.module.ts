import { ChildrenModule } from './children/children.module';
import { ImportModule } from './imports/import.module';
import { ApprovalWorkflowsModule } from './approval-workflows/approval.module';
import { CareModule } from './care/care.module';
import { HierarchyModule } from './hierarchy/hierarchy.module';
import { MeetingsModule } from './meetings/meetings.module';
import { Module } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { bindWorkspaceDatabase, getWorkspace } from './workspaces/workspace-boundary';
import { EvangelismModule } from './evangelism/evangelism.module';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './common/app.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BranchesModule } from './branches/branches.module';
import { GuestsModule } from './guests/guests.module';
import { VisitsModule } from './visits/visits.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { MembersModule } from './members/members.module';
import { AttendanceModule } from './attendance/attendance.module';
import { CommunicationsModule } from './communications/communications.module';
import { ReportsModule } from './reports/reports.module';
import { MailModule } from './mail/mail.module';
import { IntakeTemplatesModule } from './intake-templates/intake-templates.module';
import { ServiceUnitsModule } from './service-units/service-units.module';
import { ServiceTypesModule } from './service-types/service-types.module';
import { SettingsModule } from './settings/settings.module';
import { AccessScopeModule } from './access-scope/access-scope.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { OversightRegionsModule } from './oversight-regions/oversight-regions.module';
import { DistrictsModule } from './districts/districts.module';
import { WorkspaceRequestsModule } from './workspace-requests/workspace-requests.module';
import { FinanceModule } from './finance/finance.module';
import { ServiceSchedulesModule } from './service-schedules/service-schedules.module';
import { AlertsModule } from './alerts/alerts.module';
import { SearchModule } from './search/search.module';
import { DatabaseMaintenanceModule } from './database-maintenance/database-maintenance.module';
import { PushModule } from './push/push.module';
import { ChurchReportingModule } from './church-reporting/church-reporting.module';

@Module({
  imports: [
    HierarchyModule,
    ChildrenModule,
    ImportModule,
    ApprovalWorkflowsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodbUri'),
        connectionFactory: async (connection: Connection) => {
          try {
            return await bindWorkspaceDatabase(connection, getWorkspace(configService).id);
          } catch (error) {
            await connection.close();
            throw error;
          }
        },
      }),
    }),
    AuthModule,
    EvangelismModule,
    MeetingsModule,
    CareModule,
    UsersModule,
    BranchesModule,
    GuestsModule,
    VisitsModule,
    FollowUpsModule,
    MembersModule,
    AttendanceModule,
    CommunicationsModule,
    ReportsModule,
    MailModule,
    IntakeTemplatesModule,
    ServiceUnitsModule,
    ServiceTypesModule,
    SettingsModule,
    AccessScopeModule,
    AuditLogsModule,
    OversightRegionsModule,
    DistrictsModule,
    WorkspaceRequestsModule,
    FinanceModule,
    ServiceSchedulesModule,
    AlertsModule,
    SearchModule,
    DatabaseMaintenanceModule,
    PushModule,
    ChurchReportingModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
