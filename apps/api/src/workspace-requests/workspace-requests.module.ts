import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MailModule } from '../mail/mail.module';
import {
  WorkspaceRequest,
  WorkspaceRequestSchema,
} from './schemas/workspace-request.schema';
import { WorkspaceRequestsController } from './workspace-requests.controller';
import { WorkspaceRequestsService } from './workspace-requests.service';

@Module({
  imports: [
    AuditLogsModule,
    MailModule,
    MongooseModule.forFeature([
      { name: WorkspaceRequest.name, schema: WorkspaceRequestSchema },
    ]),
  ],
  controllers: [WorkspaceRequestsController],
  providers: [WorkspaceRequestsService],
  exports: [WorkspaceRequestsService],
})
export class WorkspaceRequestsModule {}
