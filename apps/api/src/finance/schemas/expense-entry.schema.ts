import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExpenseEntryDocument = HydratedDocument<ExpenseEntry>;

@Schema({ timestamps: true })
export class ExpenseEntry {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  oversightRegion!: string;

  @Prop({ required: true })
  district!: string;

  @Prop({ required: true })
  expenseDate!: Date;

  @Prop({ type: Types.ObjectId, ref: 'FinanceAccount', required: true })
  accountId!: Types.ObjectId;

  @Prop({ required: true })
  accountKey!: string;

  @Prop({ required: true })
  accountLabel!: string;

  @Prop({ type: Types.ObjectId, ref: 'ExpenseCategory', required: true })
  expenseCategoryId!: Types.ObjectId;

  @Prop({ required: true })
  expenseCategoryKey!: string;

  @Prop({ required: true })
  expenseCategoryLabel!: string;

  @Prop({ type: Types.ObjectId, ref: 'ServiceSchedule' })
  serviceScheduleId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ServiceInstance' })
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

  @Prop({ required: true, enum: ['submitted', 'approved', 'rejected', 'locked'], default: 'submitted' })
  status!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop()
  reviewNotes?: string;
}

export const ExpenseEntrySchema = SchemaFactory.createForClass(ExpenseEntry);
