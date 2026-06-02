import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type IntakeSubmissionDocument = HydratedDocument<IntakeSubmission>;

@Schema({ timestamps: true })
export class IntakeSubmission {
  @Prop({ type: Types.ObjectId, ref: 'IntakeTemplate', required: true })
  templateId!: Types.ObjectId;

  @Prop({ required: true })
  templateName!: string;

  @Prop({ required: true })
  templateKind!: string;

  @Prop({ type: Types.ObjectId, ref: 'Branch' })
  branchId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  answers!: Record<string, unknown>;

  @Prop({ default: 'completed' })
  status?: string;

  @Prop()
  serviceDate?: Date;

  @Prop()
  serviceType?: string;

  @Prop()
  serviceName?: string;

  @Prop()
  menCount?: number;

  @Prop()
  womenCount?: number;

  @Prop()
  childrenCount?: number;

  @Prop()
  adultsCount?: number;

  @Prop()
  currentAttendance?: number;

  @Prop()
  previousAttendance?: number;

  @Prop()
  growth?: number;

  @Prop()
  growthPercent?: number;

  @Prop()
  averageLastYear?: number;

  @Prop()
  averageLastPeriod?: number;

  @Prop()
  firstTimersCount?: number;

  @Prop()
  newConvertsCount?: number;

  @Prop()
  believersFoundationClassCount?: number;

  @Prop()
  holySpiritBaptismCount?: number;

  @Prop()
  waterBaptismCount?: number;

  @Prop()
  covenantHourOfPrayerAttendance?: number;

  @Prop()
  winnersSatelliteFellowshipAverage?: number;

  @Prop()
  cellCount?: number;

  @Prop()
  newCellCount?: number;

  @Prop()
  wofbiAttendance?: number;

  @Prop()
  remarks?: string;

  @Prop({ type: Types.ObjectId, ref: 'Guest' })
  guestId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  memberId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Attendance' })
  attendanceId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop()
  approvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  rejectedBy?: Types.ObjectId;

  @Prop()
  rejectedAt?: Date;
}

export const IntakeSubmissionSchema = SchemaFactory.createForClass(IntakeSubmission);
