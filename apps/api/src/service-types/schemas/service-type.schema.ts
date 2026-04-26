import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ServiceTypeDocument = HydratedDocument<ServiceType>;

@Schema({ timestamps: true })
export class ServiceType {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  key!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  notes?: string;
}

export const ServiceTypeSchema = SchemaFactory.createForClass(ServiceType);
