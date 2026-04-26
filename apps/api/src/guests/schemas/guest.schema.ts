import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type GuestDocument = HydratedDocument<Guest>;

@Schema({ timestamps: true })
export class Guest {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;

  @Prop()
  title?: string;

  @Prop({ required: true })
  firstName!: string;

  @Prop({ required: true })
  lastName!: string;

  @Prop()
  gender?: string;

  @Prop({ required: true, index: true })
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

  @Prop()
  prayerRequest?: string;

  @Prop({ default: false })
  wantsPastoralCall!: boolean;

  @Prop()
  salvationResponse?: string;

  @Prop({ default: false })
  convertedToMember!: boolean;
}

export const GuestSchema = SchemaFactory.createForClass(Guest);
