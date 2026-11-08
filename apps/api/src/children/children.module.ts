import { GuestsModule } from '../guests/guests.module';
import {
  ChildrenRegistrationLink,
  ChildrenRegistrationLinkSchema,
  ChildrenRegistration,
  ChildrenRegistrationSchema,
} from './registration.schema';
import { ChildrenRegistrationService } from './registration.service';
import {
  ChildrenRegistrationController,
  ParentRegistrationController,
} from './registration.controller';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  ChildFamily,
  ChildFamilySchema,
  ChildProfile,
  ChildProfileSchema,
  ChildSession,
  ChildSessionSchema,
  ChildKiosk,
  ChildKioskSchema,
} from './children.schema';
import { ChildrenService } from './children.service';
import {
  ChildrenController,
  ChildrenKioskController,
} from './children.controller';
@Module({
  imports: [
    GuestsModule,
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: Member.name, schema: MemberSchema },
      { name: User.name, schema: UserSchema },
      { name: ChildFamily.name, schema: ChildFamilySchema },
      { name: ChildProfile.name, schema: ChildProfileSchema },
      { name: ChildSession.name, schema: ChildSessionSchema },
      { name: ChildKiosk.name, schema: ChildKioskSchema },
      {
        name: ChildrenRegistrationLink.name,
        schema: ChildrenRegistrationLinkSchema,
      },
      { name: ChildrenRegistration.name, schema: ChildrenRegistrationSchema },
    ]),
  ],
  controllers: [
    ChildrenController,
    ChildrenKioskController,
    ChildrenRegistrationController,
    ParentRegistrationController,
  ],
  providers: [ChildrenService, ChildrenRegistrationService],
})
export class ChildrenModule {}
