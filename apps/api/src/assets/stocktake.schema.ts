import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

export type StocktakeAsset = { _id: string; tag: string; name: string; location?: string };
export type StocktakeScan = { asset: StocktakeAsset; result: 'present' | 'misplaced' };

@Schema({ timestamps: true })
export class AssetStocktake {
  @Prop({ type: SchemaTypes.ObjectId, required: true }) branchId!: Types.ObjectId;
  @Prop({ required: true }) room!: string;
  @Prop({ required: true }) actorId!: string;
  @Prop({ type: [Object], required: true }) expected!: StocktakeAsset[];
  @Prop({ type: [Object], default: [] }) scans!: StocktakeScan[];
  @Prop() completedAt?: Date;
}

export const AssetStocktakeSchema = SchemaFactory.createForClass(AssetStocktake);
AssetStocktakeSchema.index({ branchId: 1, _id: -1 });
