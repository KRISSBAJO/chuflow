import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ServiceScheduleDocument = HydratedDocument<ServiceSchedule>;

@Schema({ timestamps: true })
export class ServiceSchedule {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  oversightRegion!: string;

  @Prop({ required: true })
  district!: string;

  @Prop({ type: Types.ObjectId, ref: 'ServiceType', required: true, index: true })
  serviceTypeId!: Types.ObjectId;

  @Prop({ required: true })
  serviceTypeKey!: string;

  @Prop({ required: true })
  serviceTypeLabel!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({
    required: true,
    enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  })
  dayOfWeek!: string;

  @Prop({ required: true })
  startTime!: string;

  @Prop()
  endTime?: string;

  @Prop({ required: true, default: 'America/Chicago' })
  timezone!: string;

  @Prop()
  locationNotes?: string;

  @Prop({ default: true })
  attendanceEntryEnabled!: boolean;

  @Prop({ default: true })
  financeEntryEnabled!: boolean;

  @Prop({ default: true })
  isActive!: boolean;
}

export const ServiceScheduleSchema = SchemaFactory.createForClass(ServiceSchedule);
ServiceScheduleSchema.index(
  { branchId: 1, dayOfWeek: 1, startTime: 1, name: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);
