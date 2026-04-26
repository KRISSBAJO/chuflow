import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessScopeModule } from '../access-scope/access-scope.module';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';
import { Visit, VisitSchema } from './schemas/visit.schema';

@Module({
  imports: [
    AccessScopeModule,
    MongooseModule.forFeature([{ name: Visit.name, schema: VisitSchema }]),
  ],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService, MongooseModule],
})
export class VisitsModule {}
