import { Module } from '@nestjs/common';
import { ObjectIdReferenceMigrationService } from './object-id-reference-migration.service';

@Module({
  providers: [ObjectIdReferenceMigrationService],
})
export class DatabaseMaintenanceModule {}
