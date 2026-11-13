import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true })
export class AssetCategory {
  @Prop({ type: SchemaTypes.ObjectId, required: true }) branchId!: Types.ObjectId;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) key!: string;
}

export const AssetCategorySchema = SchemaFactory.createForClass(AssetCategory);
AssetCategorySchema.index({ branchId: 1, key: 1 }, { unique: true });
