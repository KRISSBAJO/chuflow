import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { OversightRegionsModule } from '../oversight-regions/oversight-regions.module';
import { DistrictsController } from './districts.controller';
import { DistrictsService } from './districts.service';
import { District, DistrictSchema } from './schemas/district.schema';

@Module({
  imports: [
    OversightRegionsModule,
    MongooseModule.forFeature([
      { name: District.name, schema: DistrictSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DistrictsController],
  providers: [DistrictsService],
  exports: [DistrictsService, MongooseModule],
})
export class DistrictsModule {}
