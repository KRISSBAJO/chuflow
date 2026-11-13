import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

export const assetStates = ['available', 'checked_out', 'maintenance', 'missing', 'retired'] as const;
export type AssetState = (typeof assetStates)[number];

@Schema({ _id: false })
export class AssetMovement {
  @Prop({ required: true }) state!: AssetState;
  @Prop({ required: true }) at!: Date;
  @Prop({ required: true }) actorId!: string;
  @Prop() actorEmail?: string;
  @Prop() holder?: string;
  @Prop() activity?: string;
  @Prop() note?: string;
  @Prop({ type: SchemaTypes.ObjectId }) kitCheckoutId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId }) fromBranchId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId }) toBranchId?: Types.ObjectId;
}

@Schema({ _id: false })
export class AssetReservation {
  @Prop({ required: true }) startsAt!: Date;
  @Prop({ required: true }) endsAt!: Date;
  @Prop({ required: true }) holder!: string;
  @Prop({ required: true }) activity!: string;
  @Prop({ required: true }) actorId!: string;
  @Prop() cancelledAt?: Date;
  @Prop() cancelledBy?: string;
}

@Schema({ timestamps: true })
export class Asset {
  @Prop({ type: SchemaTypes.ObjectId, required: true }) branchId!: Types.ObjectId;
  @Prop({ required: true }) tag!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) category!: string;
  @Prop() location?: string;
  @Prop() serial?: string;
  @Prop({ enum: assetStates, default: 'available' }) state!: AssetState;
  @Prop() holder?: string;
  @Prop() activity?: string;
  @Prop() dueAt?: Date;
  @Prop({ type: SchemaTypes.ObjectId }) kitId?: Types.ObjectId;
  @Prop() kitName?: string;
  @Prop({ type: SchemaTypes.ObjectId }) kitCheckoutId?: Types.ObjectId;
  @Prop({ default: 0 }) revision!: number;
  @Prop({ type: [SchemaFactory.createForClass(AssetReservation)], default: [] }) reservations!: AssetReservation[];
  @Prop({ type: [SchemaFactory.createForClass(AssetMovement)], default: [] }) history!: AssetMovement[];
}

export const AssetSchema = SchemaFactory.createForClass(Asset);
AssetSchema.index({ tag: 1 }, { unique: true });
AssetSchema.index({ branchId: 1, _id: -1 });
AssetSchema.index({ branchId: 1, kitId: 1 });
