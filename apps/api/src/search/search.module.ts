import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { FollowUp, FollowUpSchema } from '../follow-ups/schemas/follow-up.schema';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: Guest.name, schema: GuestSchema },
      { name: Member.name, schema: MemberSchema },
      { name: User.name, schema: UserSchema },
      { name: FollowUp.name, schema: FollowUpSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
