import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type PermissionDelegationDocument =
  HydratedDocument<PermissionDelegation>;

@Schema({ timestamps: true })
export class PermissionDelegation {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  recipientId!: Types.ObjectId;

  @Prop({ required: true }) permission!: string;

  @Prop({ required: true, enum: ['active', 'revoked'], default: 'active' })
  status!: string;

  @Prop({ type: Date, default: null }) expiresAt!: Date | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  grantedByUserId!: Types.ObjectId;

  @Prop({ required: true }) grantedByName!: string;

  @Prop({ required: true }) grantedAt!: Date;

  @Prop({ required: true }) reason!: string;

  @Prop({ type: [String], required: true }) scopeBranchIds!: string[];

  @Prop({ required: true }) scopeProfile!: string;

  @Prop() revokedAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  revokedByUserId?: Types.ObjectId;

  @Prop() revocationReason?: string;
  @Prop() revokedByName?: string;
}

export const PermissionDelegationSchema =
  SchemaFactory.createForClass(PermissionDelegation);

PermissionDelegationSchema.index({ recipientId: 1, status: 1, expiresAt: 1 });

PermissionDelegationSchema.index({ grantedAt: -1, _id: -1 });

PermissionDelegationSchema.index({ grantedByUserId: 1, grantedAt: -1 });

PermissionDelegationSchema.index({ scopeBranchIds: 1, grantedAt: -1 });
