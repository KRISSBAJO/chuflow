import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OversightRegionDocument = HydratedDocument<OversightRegion>;

@Schema({ timestamps: true })
export class OversightRegion {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true })
  normalizedName!: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const OversightRegionSchema = SchemaFactory.createForClass(OversightRegion);
