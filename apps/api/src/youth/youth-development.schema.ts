import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true })
export class YouthDevelopment {
  @Prop({ type: SchemaTypes.ObjectId, required: true }) groupId!: Types.ObjectId;
  @Prop({ required: true, enum: ['track', 'project', 'mentoring'] }) kind!: 'track' | 'project' | 'mentoring';
  @Prop({ required: true }) title!: string;
  @Prop({ type: [String], default: undefined }) milestones?: string[];
  @Prop() date?: string;
  @Prop() location?: string;
  @Prop({ type: SchemaTypes.ObjectId }) enrollmentId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId }) mentorId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, required: true }) createdBy!: Types.ObjectId;
  @Prop({ type: Date }) permissionConfirmedAt?: Date;
  @Prop({ type: [String], default: undefined }) checkIns?: string[];
  @Prop({ type: Date }) endedAt?: Date;
  @Prop() active?: boolean;
}
export const YouthDevelopmentSchema = SchemaFactory.createForClass(YouthDevelopment);
YouthDevelopmentSchema.index({ groupId: 1, kind: 1 });
YouthDevelopmentSchema.index({ groupId: 1, enrollmentId: 1 }, {
  unique: true, partialFilterExpression: { kind: 'mentoring', active: true },
});

@Schema()
export class YouthDevelopmentProgress {
  @Prop({ type: SchemaTypes.ObjectId, required: true }) activityId!: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, required: true }) enrollmentId!: Types.ObjectId;
  @Prop({ type: [Number], default: [] }) completed!: number[];
}
export const YouthDevelopmentProgressSchema = SchemaFactory.createForClass(YouthDevelopmentProgress);
YouthDevelopmentProgressSchema.index({ activityId: 1, enrollmentId: 1 }, { unique: true });
