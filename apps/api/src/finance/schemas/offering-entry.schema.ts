import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OfferingEntryDocument = HydratedDocument<OfferingEntry>;

@Schema({ timestamps: true })
export class OfferingEntry {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  oversightRegion!: string;

  @Prop({ required: true })
  district!: string;

  @Prop({ required: true })
  serviceDate!: Date;

  @Prop({ type: Types.ObjectId, ref: 'ServiceSchedule' })
  serviceScheduleId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ServiceInstance' })
  serviceInstanceId?: Types.ObjectId;

  @Prop()
  serviceLabel?: string;

  @Prop({ type: Types.ObjectId, ref: 'ServiceType', required: true })
  serviceTypeId!: Types.ObjectId;

  @Prop({ required: true })
  serviceTypeKey!: string;

  @Prop({ required: true })
  serviceTypeLabel!: string;

  @Prop({ type: Types.ObjectId, ref: 'OfferingType', required: true, index: true })
  offeringTypeId!: Types.ObjectId;

  @Prop({ required: true })
  offeringTypeKey!: string;

  @Prop({ required: true })
  offeringTypeLabel!: string;

  @Prop({ type: Types.ObjectId, ref: 'FinanceAccount' })
  accountId?: Types.ObjectId;

  @Prop()
  accountKey?: string;

  @Prop()
  accountLabel?: string;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, default: 'USD' })
  currency!: string;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const OfferingEntrySchema = SchemaFactory.createForClass(OfferingEntry);
