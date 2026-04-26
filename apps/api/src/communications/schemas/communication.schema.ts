import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CommunicationDocument = HydratedDocument<Communication>;

@Schema({ timestamps: true })
export class Communication {
  @Prop({ required: true })
  templateName!: string;

  @Prop()
  subject?: string;

  @Prop({ required: true })
  channel!: string;

  @Prop({ type: Types.ObjectId, ref: 'Guest' })
  guestId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  memberId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch' })
  branchId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  sentBy?: Types.ObjectId;

  @Prop()
  senderRole?: string;

  @Prop({ required: true })
  recipient!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ default: 'queued' })
  status!: string;

  @Prop()
  deliveryMode?: string;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  previewUrl?: string;

  @Prop()
  failedAt?: Date;

  @Prop()
  errorMessage?: string;

  @Prop()
  externalMessageId?: string;
}

export const CommunicationSchema = SchemaFactory.createForClass(Communication);
