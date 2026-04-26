import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FinanceAccountDocument = HydratedDocument<FinanceAccount>;

@Schema({ timestamps: true })
export class FinanceAccount {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true })
  key!: string;

  @Prop()
  description?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isSeeded!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;
}

export const FinanceAccountSchema = SchemaFactory.createForClass(FinanceAccount);
