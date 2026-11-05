import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { AccessScopeService } from './access-scope.service';
import {
  HierarchyUnit,
  HierarchyUnitSchema,
} from '../hierarchy/hierarchy.schema';
import { District, DistrictSchema } from '../districts/schemas/district.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: HierarchyUnit.name, schema: HierarchyUnitSchema },
      { name: District.name, schema: DistrictSchema },
    ]),
  ],
  providers: [AccessScopeService],
  exports: [AccessScopeService],
})
export class AccessScopeModule {}
