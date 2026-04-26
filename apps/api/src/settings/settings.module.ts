import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AppSetting, AppSettingSchema } from './schemas/app-setting.schema';
import { BranchSetting, BranchSettingSchema } from './schemas/branch-setting.schema';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    AccessScopeModule,
    AuditLogsModule,
    MongooseModule.forFeature([
      { name: AppSetting.name, schema: AppSettingSchema },
      { name: BranchSetting.name, schema: BranchSettingSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService, MongooseModule],
})
export class SettingsModule {}
