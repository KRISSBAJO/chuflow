import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type PushSubscriptionDocument = HydratedDocument<PushSubscription>;

export const PUSH_CHANNELS = ['web', 'expo'] as const;
export type PushChannel = (typeof PUSH_CHANNELS)[number];

@Schema({ _id: false })
export class PushSubscriptionKeys {
  @Prop({ required: true })
  p256dh!: string;

  @Prop({ required: true })
  auth!: string;
}

export const PushSubscriptionKeysSchema =
  SchemaFactory.createForClass(PushSubscriptionKeys);

/**
 * One device that has allowed notifications: a browser or installed web app (`web`, a Web Push
 * endpoint plus keys) or the ChuFlow phone app (`expo`, an Expo push token stored in `endpoint`).
 */
@Schema({ timestamps: true })
export class PushSubscription {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: PUSH_CHANNELS, default: 'web' })
  channel!: PushChannel;

  @Prop({ required: true, unique: true })
  endpoint!: string;

  @Prop({ type: PushSubscriptionKeysSchema })
  keys?: PushSubscriptionKeys;

  @Prop()
  userAgent?: string;

  @Prop()
  lastDeliveredAt?: Date;
}

export const PushSubscriptionSchema =
  SchemaFactory.createForClass(PushSubscription);
