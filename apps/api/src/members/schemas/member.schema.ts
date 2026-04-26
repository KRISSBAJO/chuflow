import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MemberDocument = HydratedDocument<Member>;

@Schema({ timestamps: true })
export class Member {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Guest' })
  guestId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ServiceUnit' })
  serviceUnitId?: Types.ObjectId;

  @Prop({ required: true })
  firstName!: string;

  @Prop({ required: true })
  lastName!: string;

  @Prop()
  title?: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  familyDetails?: string;

  @Prop({ default: 'active' })
  membershipStatus!: string;

  @Prop()
  dateJoinedChurch?: string;

  @Prop()
  believerFoundationClassStatus?: string;

  @Prop()
  believerFoundationClassDate?: string;

  @Prop()
  believerFoundationClassLocation?: string;

  @Prop()
  bccStatus?: string;

  @Prop()
  bccDate?: string;

  @Prop()
  bccLocation?: string;

  @Prop()
  lccStatus?: string;

  @Prop()
  lccDate?: string;

  @Prop()
  lccLocation?: string;

  @Prop()
  lcdStatus?: string;

  @Prop()
  lcdDate?: string;

  @Prop()
  lcdLocation?: string;

  @Prop()
  holySpiritBaptismStatus?: string;

  @Prop()
  waterBaptismStatus?: string;

  @Prop()
  serviceUnitInterest?: string;
}

export const MemberSchema = SchemaFactory.createForClass(Member);
