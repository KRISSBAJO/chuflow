import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsService } from './follow-ups.service';
import { FollowUp, FollowUpSchema } from './schemas/follow-up.schema';

@Module({
  imports: [
    AccessScopeModule,
    AuditLogsModule,
    MongooseModule.forFeature([
      { name: FollowUp.name, schema: FollowUpSchema },
      { name: Guest.name, schema: GuestSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
  exports: [FollowUpsService, MongooseModule],
})
export class FollowUpsModule {}
