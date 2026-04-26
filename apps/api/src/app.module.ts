import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodbUri'),
      }),
    }),
    AuthModule,
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
