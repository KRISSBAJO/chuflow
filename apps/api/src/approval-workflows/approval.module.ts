import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { MailModule } from '../mail/mail.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { District, DistrictSchema } from '../districts/schemas/district.schema';
import {
  HierarchyUnit,
  HierarchyUnitSchema,
} from '../hierarchy/hierarchy.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  ApprovalPolicy,
  ApprovalPolicySchema,
  ApprovalRequest,
  ApprovalRequestSchema,
  ApprovalNotice,
  ApprovalNoticeSchema,
} from './approval.schema';
import { ApprovalWorkflowsService } from './approval.service';
import { ApprovalWorkflowsController } from './approval.controller';
import { ApprovalWorker } from './approval.worker';
@Module({
  imports: [
    AccessScopeModule,
    MailModule,
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: District.name, schema: DistrictSchema },
      { name: User.name, schema: UserSchema },
      { name: HierarchyUnit.name, schema: HierarchyUnitSchema },
      { name: ApprovalPolicy.name, schema: ApprovalPolicySchema },
      { name: ApprovalRequest.name, schema: ApprovalRequestSchema },
      { name: ApprovalNotice.name, schema: ApprovalNoticeSchema },
    ]),
  ],
  controllers: [ApprovalWorkflowsController],
  providers: [ApprovalWorkflowsService, ApprovalWorker],
})
export class ApprovalWorkflowsModule {}
