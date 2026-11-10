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
  @Prop() nextCheckIn?: string;
  @Prop() participantNextStep?: string;
  @Prop({ type: [String], default: undefined, select: false }) mentoringEmailDates?: string[];
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
  @Prop({ type: Date }) signedUpAt?: Date;
  @Prop() serviceMinutes?: number;
  @Prop({ type: SchemaTypes.ObjectId, select: false }) serviceVerifiedBy?: Types.ObjectId;
  @Prop({ type: Date, select: false }) serviceVerifiedAt?: Date;
}
export const YouthDevelopmentProgressSchema = SchemaFactory.createForClass(YouthDevelopmentProgress);
YouthDevelopmentProgressSchema.index({ activityId: 1, enrollmentId: 1 }, { unique: true });
YouthDevelopmentProgressSchema.index({ enrollmentId: 1 });

@Schema({ timestamps: true })
export class YouthPost {
  @Prop({ type: SchemaTypes.ObjectId, required: true }) groupId!: Types.ObjectId;
  @Prop({ required: true, enum: ['update', 'devotional', 'program'] }) kind!: 'update' | 'devotional' | 'program';
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) body!: string;
  @Prop() sunday?: string;
  @Prop() scripture?: string;
  @Prop() question?: string;
  @Prop() resourceUrl?: string;
  @Prop({ type: Date }) archivedAt?: Date;
  @Prop({ type: SchemaTypes.ObjectId, required: true }) createdBy!: Types.ObjectId;
  createdAt!: Date;
}
export const YouthPostSchema = SchemaFactory.createForClass(YouthPost);
YouthPostSchema.index({ groupId: 1, archivedAt: 1, createdAt: -1 });

@Schema({ timestamps: true })
export class YouthProgramResponse {
  @Prop({ type: SchemaTypes.ObjectId, required: true }) postId!: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, required: true }) enrollmentId!: Types.ObjectId;
  @Prop({ required: true }) answer!: string;
}
export const YouthProgramResponseSchema = SchemaFactory.createForClass(YouthProgramResponse);
YouthProgramResponseSchema.index({ postId: 1, enrollmentId: 1 }, { unique: true });
YouthProgramResponseSchema.index({ enrollmentId: 1, postId: 1 });
