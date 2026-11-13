import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type GuestDocument = HydratedDocument<Guest>;

export type PrayerCareEvent = {
  at: Date;
  actor: string;
  note?: string;
  status?: string;
  assignee?: string | null;
  dueDate?: string | null;
};

@Schema({ timestamps: true })
export class Guest {
  declare createdAt?: Date;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ImportBatch' }) importBatchId?: Types.ObjectId;
  @Prop() importedAt?: Date;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;

  @Prop()
  title?: string;

  @Prop({ required: true })
  firstName!: string;

  @Prop({ required: true })
  lastName!: string;

  @Prop()
  gender?: string;

  @Prop({ index: true, default: '' })
  phone!: string;

  @Prop({ index: true, sparse: true })
  email?: string;

  @Prop()
  dateOfBirth?: string;

  @Prop()
  address?: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop()
  zipCode?: string;

  @Prop()
  maritalStatus?: string;

  @Prop()
  spouseDetails?: string;

  @Prop({ type: [String], default: [] })
  children!: string[];

  @Prop({ default: 'first_time' })
  visitStatus!: string;

  @Prop()
  invitedBy?: string;

  @Prop()
  heardAboutChurch?: string;

  @Prop({ select: false })
  prayerRequest?: string;

  @Prop({ default: false })
  wantsPastoralCall!: boolean;

  @Prop({ select: false }) prayerCareStatus?: string;
  @Prop({ type: SchemaTypes.ObjectId, select: false }) prayerCareAssigneeId?: Types.ObjectId | null;
  @Prop({ select: false }) prayerCareRevision?: number;
  @Prop({ select: false }) prayerCareUpdatedAt?: Date;
  @Prop({ type: String, select: false }) prayerCareDueDate?: string | null;
  @Prop({ type: [Object], select: false, default: undefined }) prayerCareTimeline?: PrayerCareEvent[];

  @Prop()
  salvationResponse?: string;

  @Prop({ default: false })
  convertedToMember!: boolean;

  @Prop({ type: [Object], select: false, default: undefined })
  customAnswers?: import('../guest-fields.service').GuestAnswer[];
}

export const GuestSchema = SchemaFactory.createForClass(Guest);

GuestSchema.index({updatedAt:1,_id:1});
