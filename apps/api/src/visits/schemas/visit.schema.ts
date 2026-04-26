import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VisitDocument = HydratedDocument<Visit>;

@Schema({ timestamps: true })
export class Visit {
  @Prop({ type: Types.ObjectId, ref: 'Guest', required: true })
  guestId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  visitDate!: Date;

  @Prop({ required: true })
  serviceType!: string;

  @Prop()
  notes?: string;
}

export const VisitSchema = SchemaFactory.createForClass(Visit);
