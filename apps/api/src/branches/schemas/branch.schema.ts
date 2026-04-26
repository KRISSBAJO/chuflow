import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BranchDocument = HydratedDocument<Branch>;

@Schema({ timestamps: true })
export class Branch {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ required: true, default: 'United States' })
  oversightRegion!: string;

  @Prop({ required: true, default: 'Unassigned District' })
  district!: string;

  @Prop({ required: true })
  address!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: true })
  state!: string;

  @Prop({ required: true })
  country!: string;

  @Prop({ required: true })
  contactInfo!: string;

  @Prop({ required: true })
  serviceTimes!: string;

  @Prop({ default: 'active' })
  status!: string;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
