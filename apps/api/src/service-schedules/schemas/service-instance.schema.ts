import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ServiceInstanceDocument = HydratedDocument<ServiceInstance>;

@Schema({ timestamps: true })
export class ServiceInstance {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  oversightRegion!: string;

  @Prop({ required: true })
  district!: string;

  @Prop({ type: Types.ObjectId, ref: 'ServiceSchedule', index: true })
  serviceScheduleId?: Types.ObjectId;

  @Prop()
  serviceScheduleName?: string;

  @Prop({ type: Types.ObjectId, ref: 'ServiceType', required: true, index: true })
  serviceTypeId!: Types.ObjectId;

  @Prop({ required: true })
  serviceTypeKey!: string;

  @Prop({ required: true })
  serviceTypeLabel!: string;

  @Prop({ required: true })
  serviceDate!: Date;

  @Prop({ required: true, index: true })
  serviceDateKey!: string;

  @Prop()
  startTime?: string;

  @Prop({ required: true, default: 'America/Chicago' })
  timezone!: string;

  @Prop({ required: true, enum: ['open', 'approved', 'locked'], default: 'open' })
  status!: string;

  @Prop({ default: 0 })
  attendanceSummaryCount!: number;

  @Prop({ default: 0 })
  financeEntryCount!: number;

  @Prop()
  lastActivityAt?: Date;
}

export const ServiceInstanceSchema = SchemaFactory.createForClass(ServiceInstance);
ServiceInstanceSchema.index(
  { branchId: 1, serviceScheduleId: 1, serviceDateKey: 1 },
  { unique: true, sparse: true },
);
