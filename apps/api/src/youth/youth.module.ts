import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { ChildProfile, ChildProfileSchema } from '../children/children.schema';
import { GuestsModule } from '../guests/guests.module';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { YouthController, YouthRegistrationController } from './youth.controller';
import { YouthEnrollment, YouthEnrollmentSchema, YouthGroup, YouthGroupSchema, YouthSession, YouthSessionSchema } from './youth.schema';
import { YouthService } from './youth.service';
import { YouthDevelopment, YouthDevelopmentProgress, YouthDevelopmentProgressSchema, YouthDevelopmentSchema } from './youth-development.schema';
import { YouthDevelopmentService } from './youth-development.service';

@Module({
  imports: [
    AccessScopeModule, GuestsModule,
    MongooseModule.forFeature([
      { name: YouthGroup.name, schema: YouthGroupSchema },
      { name: YouthEnrollment.name, schema: YouthEnrollmentSchema },
      { name: YouthSession.name, schema: YouthSessionSchema },
      { name: YouthDevelopment.name, schema: YouthDevelopmentSchema },
      { name: YouthDevelopmentProgress.name, schema: YouthDevelopmentProgressSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: ChildProfile.name, schema: ChildProfileSchema },
      { name: Member.name, schema: MemberSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [YouthController, YouthRegistrationController],
  providers: [YouthService, YouthDevelopmentService],
})
export class YouthModule {}
