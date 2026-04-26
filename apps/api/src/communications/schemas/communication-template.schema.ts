import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CommunicationTemplateDocument =
  HydratedDocument<CommunicationTemplate>;

@Schema({ timestamps: true })
export class CommunicationTemplate {
  @Prop({ required: true, unique: true, index: true })
  key!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, default: 'email' })
  channel!: string;

  @Prop()
  subject?: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isSeeded!: boolean;

  @Prop({ default: 100 })
  sortOrder!: number;
}

export const CommunicationTemplateSchema = SchemaFactory.createForClass(
  CommunicationTemplate,
);
