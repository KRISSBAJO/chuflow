import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { FOLLOW_UP_CONTACT_METHOD_VALUES, FOLLOW_UP_STATUS_VALUES } from '../follow-up.constants';

export type FollowUpDocument = HydratedDocument<FollowUp>;

@Schema({ timestamps: true })
export class FollowUp {
  @Prop({ type: Types.ObjectId, ref: 'Guest', required: true })
  guestId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ required: true, enum: FOLLOW_UP_STATUS_VALUES })
  status!: string;

  @Prop({ required: true, enum: FOLLOW_UP_CONTACT_METHOD_VALUES })
  contactMethod!: string;

  @Prop({ required: true })
  note!: string;

  @Prop()
  nextActionDate?: Date;
}

export const FollowUpSchema = SchemaFactory.createForClass(FollowUp);
