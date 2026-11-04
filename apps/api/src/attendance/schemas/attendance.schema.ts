import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type AttendanceDocument = HydratedDocument<Attendance>;

@Schema({ timestamps: true })
export class Attendance {
  @Prop({
    required: true,
    enum: ['individual', 'summary'],
    default: 'individual',
  })
  entryMode!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  serviceDate!: Date;

  @Prop({ required: true })
  serviceType!: string;

  @Prop()
  serviceTypeLabel?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ServiceType' })
  serviceTypeId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ServiceSchedule' })
  serviceScheduleId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ServiceInstance' })
  serviceInstanceId?: Types.ObjectId;

  @Prop()
  serviceName?: string;

  @Prop({ required: true, enum: ['guest', 'member', 'summary'] })
  personType!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Guest' })
  guestId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Member' })
  memberId?: Types.ObjectId;

  @Prop()
  menCount?: number;

  @Prop()
  womenCount?: number;

  @Prop()
  childrenCount?: number;

  @Prop()
  adultsCount?: number;

  @Prop()
  firstTimersCount?: number;

  @Prop()
  newConvertsCount?: number;

  @Prop()
  holySpiritBaptismCount?: number;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
