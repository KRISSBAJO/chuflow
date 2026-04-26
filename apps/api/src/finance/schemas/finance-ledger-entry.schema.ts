import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FinanceLedgerEntryDocument = HydratedDocument<FinanceLedgerEntry>;

@Schema({ timestamps: true })
export class FinanceLedgerEntry {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  oversightRegion!: string;

  @Prop({ required: true })
  district!: string;

  @Prop({ required: true })
  entryDate!: Date;

  @Prop({ required: true, index: true })
  periodKey!: string;

  @Prop({ type: Types.ObjectId, ref: 'FinanceAccount', required: true })
  accountId!: Types.ObjectId;

  @Prop({ required: true })
  accountKey!: string;

  @Prop({ required: true })
  accountLabel!: string;

  @Prop({ required: true, enum: ['credit', 'debit'] })
  direction!: string;

  @Prop({ required: true, enum: ['offering', 'expense', 'adjustment'] })
  sourceType!: string;

  @Prop({ required: true })
  sourceId!: string;

  @Prop({ type: Types.ObjectId, ref: 'ServiceSchedule' })
  serviceScheduleId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ServiceInstance' })
  serviceInstanceId?: Types.ObjectId;

  @Prop()
  serviceLabel?: string;

  @Prop({ required: true, min: 0.01 })
  amount!: number;

  @Prop({ required: true, default: 'USD' })
  currency!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, enum: ['approved', 'submitted', 'rejected', 'locked'], default: 'approved' })
  status!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;
}

export const FinanceLedgerEntrySchema = SchemaFactory.createForClass(FinanceLedgerEntry);
FinanceLedgerEntrySchema.index({ branchId: 1, periodKey: 1, accountId: 1, entryDate: -1 });
FinanceLedgerEntrySchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });
