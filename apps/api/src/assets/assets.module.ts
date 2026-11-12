import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { Asset, AssetSchema } from './asset.schema';
import { AssetsController } from './assets.controller';

@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: Asset.name, schema: AssetSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [AssetsController],
})
export class AssetsModule {}
