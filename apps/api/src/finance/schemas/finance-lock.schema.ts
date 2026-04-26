import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FinanceLockDocument = HydratedDocument<FinanceLock>;

@Schema({ timestamps: true })
export class FinanceLock {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  oversightRegion!: string;

  @Prop({ required: true })
  district!: string;

  @Prop({ required: true, index: true })
  periodKey!: string;

  @Prop()
  reason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  lockedBy!: Types.ObjectId;

  @Prop({ required: true, default: () => new Date() })
  lockedAt!: Date;
}

export const FinanceLockSchema = SchemaFactory.createForClass(FinanceLock);
FinanceLockSchema.index({ branchId: 1, periodKey: 1 }, { unique: true });
