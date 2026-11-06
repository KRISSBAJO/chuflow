import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type OfferingEntryDocument = HydratedDocument<OfferingEntry>;

@Schema({ timestamps: true })
export class OfferingEntry {
  @Prop({
    enum: ['submitted', 'approved', 'rejected', 'locked'],
    default: 'submitted',
    index: true,
  })
  status!: string;

  @Prop({ default: 0 })
  reviewRevision!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop()
  reviewNotes?: string;
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  oversightRegion!: string;

  @Prop({ required: true })
  district!: string;

  @Prop({ required: true })
  serviceDate!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ServiceSchedule' })
  serviceScheduleId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ServiceInstance' })
  serviceInstanceId?: Types.ObjectId;

  @Prop()
  serviceLabel?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ServiceType', required: true })
  serviceTypeId!: Types.ObjectId;

  @Prop({ required: true })
  serviceTypeKey!: string;

  @Prop({ required: true })
  serviceTypeLabel!: string;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'OfferingType',
    required: true,
    index: true,
  })
  offeringTypeId!: Types.ObjectId;

  @Prop({ required: true })
  offeringTypeKey!: string;

  @Prop({ required: true })
  offeringTypeLabel!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'FinanceAccount' })
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

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const OfferingEntrySchema = SchemaFactory.createForClass(OfferingEntry);
