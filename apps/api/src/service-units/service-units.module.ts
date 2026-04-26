import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { ServiceUnit, ServiceUnitSchema } from './schemas/service-unit.schema';
import { ServiceUnitsController } from './service-units.controller';
import { ServiceUnitsService } from './service-units.service';

@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: ServiceUnit.name, schema: ServiceUnitSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
  ],
  controllers: [ServiceUnitsController],
  providers: [ServiceUnitsService],
  exports: [ServiceUnitsService, MongooseModule],
})
export class ServiceUnitsModule {}
