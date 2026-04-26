import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DistrictDocument = HydratedDocument<District>;

@Schema({ timestamps: true })
export class District {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  normalizedName!: string;

  @Prop({ required: true })
  oversightRegion!: string;

  @Prop({ required: true })
  oversightRegionNormalized!: string;

  @Prop({ required: true, unique: true, index: true })
  key!: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const DistrictSchema = SchemaFactory.createForClass(District);
