import { Module } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';

import { AccessScopeModule } from '../access-scope/access-scope.module';

import { User, UserSchema } from '../users/schemas/user.schema';

import {
  PermissionDelegation,
  PermissionDelegationSchema,
} from './permission.schema';

import { PermissionsService } from './permissions.service';

import { PermissionsController } from './permissions.controller';

@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PermissionDelegation.name, schema: PermissionDelegationSchema },
    ]),
  ],
  providers: [PermissionsService],
  controllers: [PermissionsController],
  exports: [PermissionsService],
})
export class PermissionsModule {}
