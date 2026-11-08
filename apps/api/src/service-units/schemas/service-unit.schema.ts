import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ServiceUnitDocument = HydratedDocument<ServiceUnit>;

@Schema({ timestamps: true })
export class ServiceUnit {
  @Prop({ type: [Object], select: false, default: undefined })
  customAnswers?: import('../../guests/guest-fields.service').GuestAnswer[];

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ImportBatch' }) importBatchId?: Types.ObjectId;
  @Prop() importedAt?: Date;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Member' })
  leaderMemberId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Member' })
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
