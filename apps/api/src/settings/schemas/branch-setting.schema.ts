import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BranchSettingDocument = HydratedDocument<BranchSetting>;

@Schema({ timestamps: true })
export class BranchSetting {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, unique: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true, default: 'America/Chicago' })
  timezone!: string;

  @Prop({ required: true, default: 'USD' })
  currency!: string;

  @Prop({ required: true, default: 'en-US' })
  locale!: string;

  @Prop({ default: 120 })
  defaultServiceDurationMinutes!: number;

  @Prop({
    type: [String],
    default: ['branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up'],
  })
  attendanceApprovalRoles!: string[];

  @Prop({ default: true })
  publicGuestIntakeEnabled!: boolean;

  @Prop({ default: true })
  publicMemberIntakeEnabled!: boolean;

  @Prop({ default: true })
  publicAttendanceEntryEnabled!: boolean;

  @Prop({ default: true })
  notifyOnMissingAttendance!: boolean;

  @Prop({ default: true })
  notifyOnFollowUpBacklog!: boolean;

  @Prop({ default: true })
  notifyOnFinanceApprovals!: boolean;

  @Prop({ default: false })
  dailySummaryEnabled!: boolean;

  @Prop({ default: false })
  weeklyLeadershipDigestEnabled!: boolean;
}

export const BranchSettingSchema = SchemaFactory.createForClass(BranchSetting);
