import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ExpenseEntryDocument = HydratedDocument<ExpenseEntry>;

@Schema({ timestamps: true })
export class ExpenseEntry {
  @Prop({ type: [Object], select: false, default: undefined })
  customAnswers?: import('../../guests/guest-fields.service').GuestAnswer[];

  @Prop({ default: 0 })
  reviewRevision!: number;
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
  expenseDate!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'FinanceAccount', required: true })
  accountId!: Types.ObjectId;

  @Prop({ required: true })
  accountKey!: string;

  @Prop({ required: true })
  accountLabel!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ExpenseCategory', required: true })
  expenseCategoryId!: Types.ObjectId;

  @Prop({ required: true })
  expenseCategoryKey!: string;

  @Prop({ required: true })
  expenseCategoryLabel!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ServiceSchedule' })
  serviceScheduleId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ServiceInstance' })
  serviceInstanceId?: Types.ObjectId;

  @Prop()
  serviceLabel?: string;

  @Prop()
  payee?: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, min: 0.01 })
  amount!: number;

  @Prop({ required: true, default: 'USD' })
  currency!: string;

  @Prop()
  receiptUrl?: string;

  @Prop()
  notes?: string;

  @Prop({
    required: true,
    enum: ['submitted', 'approved', 'rejected', 'locked'],
    default: 'submitted',
  })
  status!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop()
  reviewNotes?: string;
}

export const ExpenseEntrySchema = SchemaFactory.createForClass(ExpenseEntry);
