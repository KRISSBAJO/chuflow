import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { District, DistrictSchema } from '../districts/schemas/district.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import {
  HierarchyUnit,
  HierarchyUnitSchema,
  HierarchyChange,
  HierarchyChangeSchema,
} from './hierarchy.schema';
import { HierarchyService } from './hierarchy.service';
import { HierarchyController } from './hierarchy.controller';
@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: HierarchyUnit.name, schema: HierarchyUnitSchema },
      { name: HierarchyChange.name, schema: HierarchyChangeSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: District.name, schema: DistrictSchema },
      { name: User.name, schema: UserSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Guest.name, schema: GuestSchema },
    ]),
  ],
  providers: [HierarchyService],
  controllers: [HierarchyController],
})
export class HierarchyModule {}
