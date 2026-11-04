import { Member, MemberSchema } from '../members/schemas/member.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  ServiceUnit,
  ServiceUnitSchema,
} from '../service-units/schemas/service-unit.schema';
import {
  Meeting,
  MeetingSchema,
  MeetingGroup,
  MeetingGroupSchema,
  MeetingFile,
  MeetingFileSchema,
} from './meetings.schema';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Meeting.name, schema: MeetingSchema },
      { name: MeetingGroup.name, schema: MeetingGroupSchema },
      { name: MeetingFile.name, schema: MeetingFileSchema },
      { name: User.name, schema: UserSchema },
      { name: ServiceUnit.name, schema: ServiceUnitSchema },
    ]),
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
