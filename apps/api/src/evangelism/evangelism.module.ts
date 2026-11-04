import { Module } from '@nestjs/common';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  EvangelismController,
  OutreachCaptureGuard,
} from './evangelism.controller';
import { EvangelismService } from './evangelism.service';
import {
  OutreachContact,
  OutreachContactSchema,
  OutreachLink,
  OutreachLinkSchema,
} from './evangelism.schema';

@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: Guest.name, schema: GuestSchema },
      { name: OutreachContact.name, schema: OutreachContactSchema },
      { name: OutreachLink.name, schema: OutreachLinkSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [EvangelismController],
  providers: [EvangelismService, OutreachCaptureGuard],
})
export class EvangelismModule {}
