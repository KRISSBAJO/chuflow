import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { OUTREACH_METHODS, OUTREACH_STAGES } from './evangelism.dto';

@Schema({ timestamps: true })
export class OutreachLink {
  @Prop() headerTextColor?: string;
  @Prop() buttonTextColor?: string;
  @Prop() headerColor?: string;
  @Prop() buttonColor?: string;
  @Prop() churchName?: string;
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;
  @Prop({ required: true, unique: true }) token!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ enum: ['personal', 'branch'], required: true }) kind!: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' }) ownerId?: Types.ObjectId;
  @Prop({ default: true }) isActive!: boolean;
}
export type OutreachLinkDocument = HydratedDocument<OutreachLink>;
export const OutreachLinkSchema = SchemaFactory.createForClass(OutreachLink);

@Schema({ _id: false })
export class OutreachActivity {
  @Prop({ required: true }) note!: string;
  @Prop({ required: true, enum: OUTREACH_STAGES }) stage!: string;
  @Prop({ required: true }) contactMethod!: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  recordedBy?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;
  @Prop() nextActionDate?: Date;
  @Prop({ required: true }) createdAt!: Date;
}
const OutreachActivitySchema = SchemaFactory.createForClass(OutreachActivity);

@Schema({ timestamps: true })
export class OutreachContact {
  @Prop({ type: [Object], select: false, default: undefined })
  customAnswers?: import('../guests/guest-fields.service').GuestAnswer[];

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Guest' }) guestId?: Types.ObjectId;
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'OutreachLink' })
  linkId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' }) reachedBy?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;
  @Prop({ required: true }) firstName!: string;
  @Prop({ required: true }) lastName!: string;
  @Prop({ required: true }) phone!: string;
  @Prop({ required: true }) normalizedPhone!: string;
  @Prop() email?: string;
  @Prop() city?: string;
  @Prop() prayerRequest?: string;
  @Prop() interest?: string;
  @Prop() preferredContactTime?: string;
  @Prop({ required: true, enum: OUTREACH_METHODS })
  preferredContactMethod!: string;
  @Prop({ required: true }) consentToContact!: boolean;
  @Prop({ required: true }) consentRecordedAt!: Date;
  @Prop({ default: 'new', enum: OUTREACH_STAGES }) stage!: string;
  @Prop({ index: true }) nextActionDate?: Date;
  @Prop({ default: 0 }) revision!: number;
  @Prop({ type: [OutreachActivitySchema], default: [] })
  activities!: OutreachActivity[];
}
export type OutreachContactDocument = HydratedDocument<OutreachContact>;
export const OutreachContactSchema =
  SchemaFactory.createForClass(OutreachContact);
OutreachContactSchema.index(
  { branchId: 1, normalizedPhone: 1 },
  { unique: true },
);
OutreachContactSchema.index({ branchId: 1, stage: 1, nextActionDate: 1 });

OutreachContactSchema.index({updatedAt:1,_id:1});
