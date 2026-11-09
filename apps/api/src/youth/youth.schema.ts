import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true })
export class YouthGroup {
  @Prop({ type: SchemaTypes.ObjectId, required: true }) branchId!: Types.ObjectId;
  @Prop({ required: true }) key!: string;
  @Prop({ required: true }) program!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) minAge!: number;
  @Prop({ required: true }) maxAge!: number;
  @Prop({ required: true }) meetingDay!: number;
  @Prop({ default: 18 }) guardianUnderAge!: number;
  @Prop({ type: SchemaTypes.ObjectId }) leaderId?: Types.ObjectId;
  @Prop() clearanceUntil?: string;
  @Prop({ type: SchemaTypes.ObjectId, select: false }) clearanceVerifiedBy?: Types.ObjectId;
  @Prop({ type: Date, select: false }) clearanceVerifiedAt?: Date;
  @Prop({ select: false }) registrationToken?: string;
}
export const YouthGroupSchema = SchemaFactory.createForClass(YouthGroup);
YouthGroupSchema.index({ branchId: 1, key: 1 }, { unique: true });
YouthGroupSchema.index({ registrationToken: 1 }, { unique: true, sparse: true });

@Schema({ timestamps: true })
export class YouthEnrollment {
  @Prop({ type: SchemaTypes.ObjectId, required: true }) groupId!: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, required: true }) branchId!: Types.ObjectId;
  @Prop({ required: true }) firstName!: string;
  @Prop({ required: true }) lastName!: string;
  @Prop({ required: true, select: false }) birthDate!: string;
  @Prop({ required: true, select: false }) contact!: string;
  @Prop({ select: false }) guardianName?: string;
  @Prop({ type: [Object], select: false, default: undefined }) customAnswers?: import('../guests/guest-fields.service').GuestAnswer[];
  @Prop({ required: true, select: false }) registrationKey!: string;
  @Prop({ required: true }) needsGuardian!: boolean;
  @Prop({ required: true }) consentVersion!: number;
  @Prop({ required: true }) consentLocale!: string;
  @Prop({ required: true, default: 'public' }) consentSource!: 'public' | 'staff';
  @Prop({ type: Date, required: true }) consentAt!: Date;
  @Prop({ default: 'pending' }) state!: 'pending' | 'active' | 'declined' | 'withdrawn';
  @Prop({ type: SchemaTypes.ObjectId }) memberId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId }) childId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, select: false }) linkedEnrollmentId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId }) reviewedBy?: Types.ObjectId;
  @Prop({ type: Date }) reviewedAt?: Date;
  @Prop({ type: Date }) welcomedAt?: Date;
  @Prop({ type: SchemaTypes.ObjectId }) withdrawnBy?: Types.ObjectId;
  @Prop({ type: Date }) withdrawnAt?: Date;
}
export const YouthEnrollmentSchema = SchemaFactory.createForClass(YouthEnrollment);
YouthEnrollmentSchema.index({ groupId: 1, registrationKey: 1 }, { unique: true });
YouthEnrollmentSchema.index({ groupId: 1, memberId: 1 }, { unique: true, partialFilterExpression: { memberId: { $type: 'objectId' } } });
YouthEnrollmentSchema.index({ groupId: 1, childId: 1 }, { unique: true, partialFilterExpression: { childId: { $type: 'objectId' } } });
YouthEnrollmentSchema.index({ groupId: 1, linkedEnrollmentId: 1 }, { unique: true, partialFilterExpression: { linkedEnrollmentId: { $type: 'objectId' } } });

@Schema()
export class YouthSession {
  @Prop({ type: SchemaTypes.ObjectId, required: true }) groupId!: Types.ObjectId;
  @Prop({ required: true }) date!: string;
  @Prop({ type: [SchemaTypes.ObjectId], default: [] }) present!: Types.ObjectId[];
}
export const YouthSessionSchema = SchemaFactory.createForClass(YouthSession);
YouthSessionSchema.index({ groupId: 1, date: 1 }, { unique: true });
