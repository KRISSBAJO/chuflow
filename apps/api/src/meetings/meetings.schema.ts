import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true })
export class MeetingGroup {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;
  @Prop({ default: false }) isGeneral!: boolean;
  @Prop({ required: true }) name!: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ServiceUnit' })
  serviceUnitId?: Types.ObjectId;
  @Prop({ default: true }) enabled!: boolean;
  @Prop({ default: true }) minutesRequired!: boolean;
  @Prop({ default: 72 }) minutesDueHours!: number;
  @Prop({ type: [String], default: [] }) submitterUserIds!: string[];
  @Prop({ type: [String], default: [] }) reviewerUserIds!: string[];
  @Prop({ default: 0 }) revision!: number;
}
export type MeetingGroupDocument = HydratedDocument<MeetingGroup>;
export const MeetingGroupSchema = SchemaFactory.createForClass(MeetingGroup);
MeetingGroupSchema.index(
  { branchId: 1, isGeneral: 1 },
  { unique: true, partialFilterExpression: { isGeneral: true } },
);

export type MeetingAction = {
  id: string;
  title: string;
  ownerUserId: string;
  dueAt?: string;
  status: 'open' | 'done';
};
export type MinutesHistory = {
  revision: number;
  body: string;
  links: string[];
  status: string;
  by: string;
  at: string;
  comment?: string;
};
@Schema({ timestamps: true })
export class Meeting {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'MeetingGroup',
    required: true,
    index: true,
  })
  groupId!: Types.ObjectId;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) agenda!: string;
  @Prop({ required: true, index: true }) startsAt!: Date;
  @Prop({ required: true }) endsAt!: Date;
  @Prop({ default: '' }) location!: string;
  @Prop({ default: '' }) joinUrl!: string;
  @Prop({ required: true }) organizerUserId!: string;
  @Prop({ type: [String], default: [] }) attendeeUserIds!: string[];
  @Prop({
    enum: ['individuals', 'service_groups', 'church'],
    default: 'individuals',
  })
  audienceMode!: string;
  @Prop({ type: [String], default: [] }) audienceServiceUnitIds!: string[];
  @Prop({ type: [String], default: undefined }) additionalMemberIds?: string[];
  @Prop({ default: false }) invitationsRequested!: boolean;
  @Prop({ default: false }) invitationsPrepared!: boolean;
  @Prop({ type: [String], default: [] }) attendeeMemberIds!: string[];
  @Prop({ type: [String], default: [] }) presentMemberIds!: string[];
  @Prop({ type: [String], default: [] }) presentUserIds!: string[];
  @Prop({
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled',
  })
  status!: string;
  @Prop({ default: true }) minutesRequired!: boolean;
  @Prop({ required: true }) minutesDueAt!: Date;
  @Prop({ default: '' }) minutesBody!: string;
  @Prop({ type: [String], default: [] }) minutesLinks!: string[];
  @Prop({
    enum: ['draft', 'submitted', 'approved', 'changes_requested'],
    default: 'draft',
  })
  minutesStatus!: string;
  @Prop({ default: '' }) reviewComment!: string;
  @Prop({ type: [Object], default: [] }) minutesHistory!: MinutesHistory[];
  @Prop({ type: [String], default: [] }) attachmentIds!: string[];
  @Prop({ type: [Object], default: [] }) actions!: MeetingAction[];
  @Prop({ default: 0 }) revision!: number;
}
export type MeetingDocument = HydratedDocument<Meeting>;
export const MeetingSchema = SchemaFactory.createForClass(Meeting);
MeetingSchema.index({ branchId: 1, startsAt: -1 });
@Schema({ timestamps: true })
export class MeetingFile {
  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  meetingId!: Types.ObjectId;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) mime!: string;
  @Prop({ required: true }) size!: number;
  @Prop({ required: true }) uploadedBy!: string;
  @Prop({ type: Buffer, required: true, select: false }) data!: Buffer;
}
export type MeetingFileDocument = HydratedDocument<MeetingFile>;
export const MeetingFileSchema = SchemaFactory.createForClass(MeetingFile);

@Schema({ timestamps: true })
export class MeetingInvitation {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Meeting', required: true })
  meetingId!: Types.ObjectId;
  @Prop({ required: true }) email!: string;
  @Prop({ type: [String], default: [] }) memberIds!: string[];
  @Prop({ type: [String], default: [] }) userIds!: string[];
  @Prop({
    enum: ['queued', 'sending', 'sent', 'failed', 'uncertain', 'cancelled'],
    default: 'queued',
  })
  status!: string;
  @Prop() claimedAt?: Date;
  @Prop() sentAt?: Date;
  @Prop() messageId?: string;
  @Prop({ default: '' }) error!: string;
}
export type MeetingInvitationDocument = HydratedDocument<MeetingInvitation>;
export const MeetingInvitationSchema =
  SchemaFactory.createForClass(MeetingInvitation);
MeetingInvitationSchema.index({ meetingId: 1, email: 1 }, { unique: true });
MeetingInvitationSchema.index({ status: 1, createdAt: 1 });
