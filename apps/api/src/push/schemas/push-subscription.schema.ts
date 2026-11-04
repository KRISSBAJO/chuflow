import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type PushSubscriptionDocument = HydratedDocument<PushSubscription>;

@Schema({ _id: false })
export class PushSubscriptionKeys {
  @Prop({ required: true })
  p256dh!: string;

  @Prop({ required: true })
  auth!: string;
}

export const PushSubscriptionKeysSchema =
  SchemaFactory.createForClass(PushSubscriptionKeys);

/** One browser or installed app on one device that has allowed notifications. */
@Schema({ timestamps: true })
export class PushSubscription {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  endpoint!: string;

  @Prop({ type: PushSubscriptionKeysSchema, required: true })
  keys!: PushSubscriptionKeys;

  @Prop()
  userAgent?: string;

  @Prop()
  lastDeliveredAt?: Date;
}

export const PushSubscriptionSchema =
  SchemaFactory.createForClass(PushSubscription);
