import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, SchemaTypes } from 'mongoose';
@Schema({ timestamps: true })
export class ImportBatch {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;
  @Prop({ required: true }) kind!: string;
  @Prop({ required: true }) createdBy!: string;
  @Prop({ required: true }) requestKey!: string;
  @Prop({ required: true }) expectedRows!: number;
  @Prop({ default: 'iso' }) dateFormat!: string;
  @Prop({ default: 'uploading' }) status!: string;
  @Prop({ default: 0 }) valid!: number;
  @Prop({ default: 0 }) duplicates!: number;
  @Prop({ default: 0 }) invalid!: number;
  @Prop() lease?: string;
  @Prop() leaseUntil?: Date;
  @Prop() validatedAt?: Date;
  @Prop({ required: true }) expiresAt!: Date;
}
export const ImportBatchSchema = SchemaFactory.createForClass(ImportBatch);
ImportBatchSchema.index({ createdBy: 1, requestKey: 1 }, { unique: true });
ImportBatchSchema.index({ branchId: 1, createdAt: -1 });
ImportBatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
@Schema({ timestamps: true })
export class ImportRow {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ImportBatch', required: true })
  batchId!: Types.ObjectId;
  @Prop({ required: true }) position!: number;
  @Prop({ required: true }) sourceRow!: number;
  @Prop({ type: Object, required: true }) values!: Record<string, string>;
  @Prop({ required: true }) hash!: string;
  @Prop({ type: Object }) normalized?: Record<string, unknown>;
  @Prop({ default: 'uploaded' }) status!: string;
  @Prop({ default: '' }) reason!: string;
  @Prop({ required: true }) expiresAt!: Date;
}
export const ImportRowSchema = SchemaFactory.createForClass(ImportRow);
ImportRowSchema.index({ batchId: 1, position: 1 }, { unique: true });
ImportRowSchema.index({ batchId: 1, status: 1, position: 1 });
ImportRowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
@Schema()
export class ImportLock {
  @Prop({ type: String }) _id!: string;
  @Prop({ required: true }) owner!: string;
  @Prop({ required: true }) until!: Date;
}
export const ImportLockSchema = SchemaFactory.createForClass(ImportLock);
