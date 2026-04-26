import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ServiceUnitDocument = HydratedDocument<ServiceUnit>;

@Schema({ timestamps: true })
export class ServiceUnit {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  leaderMemberId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  secretaryMemberId?: Types.ObjectId;

  @Prop({ required: true })
  meetingDay!: string;

  @Prop({ required: true })
  prayerDay!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  notes?: string;
}

export const ServiceUnitSchema = SchemaFactory.createForClass(ServiceUnit);
