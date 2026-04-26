import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { District, DistrictSchema } from '../districts/schemas/district.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { OversightRegionsController } from './oversight-regions.controller';
import { OversightRegionsService } from './oversight-regions.service';
import {
  OversightRegion,
  OversightRegionSchema,
} from './schemas/oversight-region.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OversightRegion.name, schema: OversightRegionSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: District.name, schema: DistrictSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [OversightRegionsController],
  providers: [OversightRegionsService],
  exports: [OversightRegionsService, MongooseModule],
})
export class OversightRegionsModule {}
