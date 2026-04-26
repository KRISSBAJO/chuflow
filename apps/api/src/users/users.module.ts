import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { DistrictsModule } from '../districts/districts.module';
import { OversightRegionsModule } from '../oversight-regions/oversight-regions.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    ConfigModule,
    AccessScopeModule,
    AuditLogsModule,
    OversightRegionsModule,
    DistrictsModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
