import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { GuestsModule } from '../guests/guests.module';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import { ServiceUnit, ServiceUnitSchema } from '../service-units/schemas/service-unit.schema';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { Member, MemberSchema } from './schemas/member.schema';

@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: Guest.name, schema: GuestSchema },
      { name: ServiceUnit.name, schema: ServiceUnitSchema },
    ]),
    forwardRef(() => GuestsModule),
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService, MongooseModule],
})
export class MembersModule {}
