import { Global, Module } from '@nestjs/common';
import { ControlDatabase } from './control-database';
import { EntitlementsService } from './entitlements.service';

/** Global so any service can ask about quotas without wiring an import. */
@Global()
@Module({
  providers: [ControlDatabase, EntitlementsService],
  exports: [ControlDatabase, EntitlementsService],
})
export class EntitlementsModule {}
