import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, SchemaTypes } from 'mongoose';
export const LEVELS = [
  'church',
  'area',
  'zone',
  'district',
  'national',
] as const;
export type ApprovalLevel = (typeof LEVELS)[number];
export type ApprovalStage = {
  level: ApprovalLevel;
  label: string;
  reviewerIds: string[];
  reviewerNames: string[];
  unitId?: string;
};
export type ApprovalEvent = {
  action: string;
  actorId: string;
  actorName: string;
  level?: string;
  note: string;
  at: Date;
  submission?: Record<string, unknown>;
};
@Schema({ timestamps: true })
export class ApprovalPolicy {
  @Prop({ required: true, index: true }) oversightRegion!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) category!: string;
  @Prop({ type: String, required: true, enum: LEVELS })
  finalLevel!: ApprovalLevel;
  @Prop() thresholdAmount?: number;
  @Prop({ type: String, enum: LEVELS }) aboveThresholdLevel?: ApprovalLevel;
  @Prop({ default: 'USD' }) currency!: string;
  @Prop({ default: 3 }) reviewDays!: number;
  @Prop({ default: true }) isActive!: boolean;
  @Prop({ default: 0 }) revision!: number;
  @Prop({ type: [Object], default: [] }) history!: ApprovalEvent[];
}
export const ApprovalPolicySchema =
  SchemaFactory.createForClass(ApprovalPolicy);
@Schema({ timestamps: true })
export class ApprovalRequest {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;
  @Prop({ required: true }) branchName!: string;
  @Prop({ required: true }) oversightRegion!: string;
  @Prop({ required: true, index: true }) requesterId!: string;
  @Prop({ required: true }) requesterName!: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ApprovalPolicy', required: true })
  policyId!: Types.ObjectId;
  @Prop({ required: true }) policyName!: string;
  @Prop({ required: true }) category!: string;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) details!: string;
  @Prop({ type: [String], default: [] }) documentLinks!: string[];
  @Prop() amount?: number;
  @Prop() currency?: string;
  @Prop({ type: String, required: true, enum: LEVELS })
  finalLevel!: ApprovalLevel;
  @Prop({ type: [Object], required: true }) stages!: ApprovalStage[];
  @Prop({ default: 0 }) currentStage!: number;
  @Prop({ type: [String], default: [], index: true })
  currentReviewerIds!: string[];
  @Prop({ type: [String], default: [], index: true }) participantIds!: string[];
  @Prop({
    default: 'pending',
    enum: ['pending', 'approved', 'rejected', 'returned', 'withdrawn'],
    index: true,
  })
  status!: string;
  @Prop({ type: [Object], default: [] }) history!: ApprovalEvent[];
  @Prop({ required: true, index: true }) dueAt!: Date;
  @Prop({ default: 3 }) reviewDays!: number;
  @Prop({ default: 0 }) revision!: number;
  @Prop() nextReminderAt?: Date;
  @Prop({ default: -1 }) notificationRevision!: number;
}
export const ApprovalRequestSchema =
  SchemaFactory.createForClass(ApprovalRequest);
ApprovalRequestSchema.index({ requesterId: 1, status: 1, createdAt: -1 });
ApprovalRequestSchema.index({
  currentReviewerIds: 1,
  status: 1,
  createdAt: -1,
});
@Schema({ timestamps: true })
export class ApprovalNotice {
  @Prop({ required: true, unique: true }) key!: string;
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true }) requestId!: string;
  @Prop({ default: 'pending' }) status!: string;
  @Prop({ default: 0 }) attempts!: number;
  @Prop({ required: true }) availableAt!: Date;
  @Prop() leaseUntil?: Date;
}
export const ApprovalNoticeSchema =
  SchemaFactory.createForClass(ApprovalNotice);
ApprovalNoticeSchema.index({ status: 1, availableAt: 1 });
