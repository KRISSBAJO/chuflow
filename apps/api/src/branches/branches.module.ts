import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { DistrictsModule } from '../districts/districts.module';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { OversightRegionsModule } from '../oversight-regions/oversight-regions.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { Branch, BranchSchema } from './schemas/branch.schema';

@Module({
  imports: [
    AccessScopeModule,
    OversightRegionsModule,
    DistrictsModule,
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: Guest.name, schema: GuestSchema },
      { name: Member.name, schema: MemberSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService, MongooseModule],
})
export class BranchesModule {}
