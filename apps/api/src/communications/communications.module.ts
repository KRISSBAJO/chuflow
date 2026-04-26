import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Guest, GuestSchema } from '../guests/schemas/guest.schema';
import { MailModule } from '../mail/mail.module';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { Communication, CommunicationSchema } from './schemas/communication.schema';
import {
  CommunicationTemplate,
  CommunicationTemplateSchema,
} from './schemas/communication-template.schema';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';

@Module({
  imports: [
    AccessScopeModule,
    AuditLogsModule,
    MailModule,
    MongooseModule.forFeature([
      { name: Communication.name, schema: CommunicationSchema },
      {
        name: CommunicationTemplate.name,
        schema: CommunicationTemplateSchema,
      },
      { name: Guest.name, schema: GuestSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
  ],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
})
export class CommunicationsModule {}
