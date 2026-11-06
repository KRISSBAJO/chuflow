import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, SchemaTypes } from 'mongoose';
export type Guardian = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  relationship: string;
  memberId?: string;
  canCheckIn: boolean;
};
export type ChildVisit = {
  id: string;
  childId: string;
  familyId: string;
  childName: string;
  roomId: string;
  broughtById: string;
  broughtByName: string;
  checkedInAt: Date;
  status: 'checked_in' | 'checked_out';
  pickupHash: string;
  pickupDisplay: string;
  checkedOutAt?: Date;
  collectedById?: string;
  collectedByName?: string;
};
export type ChildRoom = {
  id: string;
  name: string;
  minMonths: number;
  maxMonths: number;
  capacity: number;
};
export type ChildEvent = {
  action: string;
  actorId: string;
  at: Date;
  note: string;
  childIds?: string[];
  guardianId?: string;
};
@Schema({ timestamps: true })
export class ChildFamily {
  @Prop({ required: true, unique: true }) requestKey!: string;
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;
  @Prop({ required: true }) name!: string;
  @Prop({ type: [Object], required: true }) guardians!: Guardian[];
  @Prop({ select: false, index: true }) cardHash?: string;
  @Prop({ default: true }) isActive!: boolean;
  @Prop({ default: 0 }) revision!: number;
  @Prop({ type: [Object], default: [] }) events!: ChildEvent[];
}
export const ChildFamilySchema = SchemaFactory.createForClass(ChildFamily);
ChildFamilySchema.index({ branchId: 1, name: 1 });
@Schema({ timestamps: true })
export class ChildProfile {
  @Prop({ required: true, unique: true }) requestKey!: string;
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'ChildFamily',
    required: true,
    index: true,
  })
  familyId!: Types.ObjectId;
  @Prop({ required: true }) firstName!: string;
  @Prop({ required: true }) lastName!: string;
  @Prop({ required: true }) birthDate!: string;
  @Prop({ type: [String], required: true }) guardianIds!: string[];
  @Prop({ type: [String], required: true }) pickupGuardianIds!: string[];
  @Prop({ default: '' }) careNotes!: string;
  @Prop({ default: '' }) pickupNotes!: string;
  @Prop({ default: false }) photoConsent!: boolean;
  @Prop() photoUrl?: string;
  @Prop({ default: true }) isMember!: boolean;
  @Prop({ default: true }) isActive!: boolean;
  @Prop({ select: false, index: true }) cardHash?: string;
  @Prop({ default: 0 }) revision!: number;
  @Prop({ type: [Object], default: [] }) events!: ChildEvent[];
}
export const ChildProfileSchema = SchemaFactory.createForClass(ChildProfile);
ChildProfileSchema.index({ branchId: 1, lastName: 1, firstName: 1 });
@Schema({ timestamps: true })
export class ChildSession {
  @Prop({ required: true, unique: true }) requestKey!: string;
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
  })
  branchId!: Types.ObjectId;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) startsAt!: Date;
  @Prop({ required: true }) endsAt!: Date;
  @Prop({ enum: ['open', 'closed'], default: 'open' }) status!: string;
  @Prop({ type: [Object], required: true }) rooms!: ChildRoom[];
  @Prop({ type: [Object], default: [] }) visits!: ChildVisit[];
  @Prop({ type: [Object], default: [] }) events!: ChildEvent[];
  @Prop({ default: 0 }) revision!: number;
}
export const ChildSessionSchema = SchemaFactory.createForClass(ChildSession);
ChildSessionSchema.index({ branchId: 1, startsAt: -1 });
ChildSessionSchema.index(
  { branchId: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } },
);
@Schema({ timestamps: true })
export class ChildKiosk {
  @Prop({ required: true, unique: true, select: false }) tokenHash!: string;
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'ChildSession',
    required: true,
    index: true,
  })
  sessionId!: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;
  @Prop({ required: true }) expiresAt!: Date;
  @Prop({ default: false }) revoked!: boolean;
  @Prop({ required: true }) createdBy!: string;
  @Prop({ required: true }) label!: string;
  @Prop() windowAt?: Date;
  @Prop({ default: 0 }) attempts!: number;
}
export const ChildKioskSchema = SchemaFactory.createForClass(ChildKiosk);
ChildKioskSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
