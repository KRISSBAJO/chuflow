import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, SchemaTypes } from 'mongoose';
export type ParentAdult = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  relationship: string;
};
export type ParentChild = {
  customAnswers?: import('../guests/guest-fields.service').GuestAnswer[];
  firstName: string;
  lastName: string;
  birthDate: string;
  pickupAdults: number[];
  careNotes: string;
};
@Schema({ timestamps: true })
export class ChildrenRegistrationLink {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    unique: true,
  })
  branchId!: Types.ObjectId;
  @Prop({ required: true, select: false, index: true }) tokenHash!: string;
  @Prop({ select: false }) publicToken?: string;
  @Prop({ default: true }) isActive!: boolean;
  @Prop() windowAt?: Date;
  @Prop({ default: 0 }) attempts!: number;
  @Prop({ required: true }) changedBy!: string;
}
export const ChildrenRegistrationLinkSchema = SchemaFactory.createForClass(
  ChildrenRegistrationLink,
);
@Schema({ timestamps: true })
export class ChildrenRegistration {
  @Prop({ type: [Object], default: undefined })
  customAnswers?: import('../guests/guest-fields.service').GuestAnswer[];
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;
  @Prop({ required: true, unique: true }) requestKey!: string;
  @Prop({ required: true }) familyName!: string;
  @Prop({ type: [Object], required: true }) adults!: ParentAdult[];
  @Prop({ type: [Object], required: true }) children!: ParentChild[];
  @Prop({ required: true }) consentAt!: Date;
  @Prop({ default: 'parent-registration-v1' }) consentVersion!: string;
  @Prop({
    enum: ['pending', 'processing', 'approved', 'rejected', 'handled'],
    default: 'pending',
  })
  status!: string;
  @Prop({ default: 0 }) revision!: number;
  @Prop() processingAt?: Date;
  @Prop({ default: false }) approvalStarted!: boolean;
  @Prop() approvalAsMembers?: boolean;
  @Prop() reviewedBy?: string;
  @Prop() reviewedAt?: Date;
  @Prop() reviewNote?: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ChildFamily' })
  familyId?: Types.ObjectId;
}
export const ChildrenRegistrationSchema =
  SchemaFactory.createForClass(ChildrenRegistration);
ChildrenRegistrationSchema.index({ branchId: 1, status: 1, createdAt: -1 });
