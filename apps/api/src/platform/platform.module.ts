import { Module } from '@nestjs/common';
import { EntitlementsModule } from './entitlements.module';
import { OperatorsService } from './operators.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';
import { PlatformWorkspacesService } from './platform-workspaces.service';
import { PlatformController } from './platform.controller';

/** The control plane. Its routes answer 404 unless PLATFORM_ENABLED is on for this API. */
@Module({
  imports: [EntitlementsModule],
  providers: [
    OperatorsService,
    PlatformAuditService,
    PlatformSubscriptionsService,
    PlatformWorkspacesService,
  ],
  controllers: [PlatformController],
})
export class PlatformModule {}
