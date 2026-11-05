import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
@Schema({ timestamps: true })
export class CareCase {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;
  @Prop({ required: true }) personKey!: string;
  @Prop({ enum: ['guest', 'member', 'outreach'], required: true })
  personType!: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Guest' }) guestId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Member' })
  memberId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'OutreachContact' })
  outreachId?: Types.ObjectId;
  @Prop({ required: true }) firstName!: string;
  @Prop({ required: true }) lastName!: string;
  @Prop() email?: string;
  @Prop() phone?: string;
  @Prop({ default: 'guest_welcome' }) journey!: string;
  @Prop({
    enum: ['new', 'connecting', 'connected', 'paused', 'closed'],
    default: 'new',
  })
  stage!: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' }) ownerId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' }) backupId?: Types.ObjectId;
  @Prop({ type: Object }) handover?: {
    to: string;
    from: string;
    requestedAt: string;
    status: string;
  };
  @Prop({ default: false }) stopContact!: boolean;
  @Prop({ default: false }) emailAllowed!: boolean;
  @Prop({ default: 'en' }) language!: string;
  @Prop() permissionRecordedAt?: Date;
  @Prop() permissionRecordedBy?: string;
  @Prop() pausedUntil?: Date;
  @Prop({ default: '' }) absenceExplanation!: string;
  @Prop() firstContactAt?: Date;
  @Prop() firstReturnAt?: Date;
  @Prop() lastReturnAt?: Date;
  @Prop() connectedAt?: Date;
  @Prop({ type: [Object], default: [] }) pendingEvents!: Record<
    string,
    unknown
  >[];
  @Prop({ default: false }) wantsPastoralCall!: boolean;
  @Prop() lastContactAt?: Date;
  @Prop() lastAttendanceAt?: Date;
  @Prop() enrollmentRequestedAt?: Date;
  @Prop() automationEnrolledAt?: Date;
  @Prop() enrollmentCompletedAt?: Date;
  @Prop() sourceCreatedAt?: Date;
  @Prop({ default: 0 }) unansweredAttempts!: number;
  @Prop() automatedCycle?: string;
  @Prop({ default: 0 }) automatedAttempts!: number;
  @Prop({ type: [String], default: [] }) milestones!: string[];
  @Prop({ default: 0 }) revision!: number;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'CareCase' })
  mergedInto?: Types.ObjectId;
}
export const CareCaseSchema = SchemaFactory.createForClass(CareCase);
CareCaseSchema.index({ branchId: 1, personKey: 1 }, { unique: true });
CareCaseSchema.index({ branchId: 1, ownerId: 1, stage: 1 });
export type CareCaseDocument = HydratedDocument<CareCase>;
@Schema({ timestamps: true })
export class CareTask {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'CareCase',
    required: true,
    index: true,
  })
  caseId!: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;
  @Prop({ required: true }) key!: string;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) kind!: string;
  @Prop({ enum: ['open', 'done', 'cancelled'], default: 'open' })
  status!: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;
  @Prop({ required: true, index: true }) dueAt!: Date;
  @Prop({ default: '' }) evidence!: string;
  @Prop({ default: 0 }) attempts!: number;
  @Prop({ default: false }) escalated!: boolean;
  @Prop() completedAt?: Date;
  @Prop() outcome?: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ServiceUnit' })
  serviceUnitId?: Types.ObjectId;
}
export const CareTaskSchema = SchemaFactory.createForClass(CareTask);
CareTaskSchema.index({ caseId: 1, key: 1 }, { unique: true });
CareTaskSchema.index({ branchId: 1, status: 1, dueAt: 1 });
CareTaskSchema.index({ assignedTo: 1, status: 1, dueAt: 1 });
export type CareTaskDocument = HydratedDocument<CareTask>;
@Schema({ timestamps: true })
export class CareEvent {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'CareCase', required: true })
  caseId!: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;
  @Prop({ required: true, unique: true }) key!: string;
  @Prop({ required: true }) kind!: string;
  @Prop({ required: true }) text!: string;
  @Prop({ default: 'team', enum: ['team', 'pastoral'] }) visibility!: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' }) actorId?: Types.ObjectId;
  @Prop({ type: Object }) data?: Record<string, unknown>;
}
export const CareEventSchema = SchemaFactory.createForClass(CareEvent);
CareEventSchema.index({ caseId: 1, createdAt: -1 });
export type CareEventDocument = HydratedDocument<CareEvent>;
@Schema({ timestamps: true })
export class CarePlan {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Branch',
    required: true,
    unique: true,
  })
  branchId!: Types.ObjectId;
  @Prop({ default: false }) enabled!: boolean;
  @Prop() enabledAt?: Date;
  @Prop({ type: [String], default: [] }) teamIds!: string[];
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' }) leaderId?: Types.ObjectId;
  @Prop({ type: Object, default: {} }) unavailableUntil!: Record<
    string,
    string
  >;
  @Prop({ default: 24 }) firstContactHours!: number;
  @Prop({ default: 48 }) retryHours!: number;
  @Prop({ default: 3 }) maxAttempts!: number;
  @Prop({ default: 48 }) escalationHours!: number;
  @Prop({ default: 25 }) capacity!: number;
  @Prop({ default: false }) emailEnabled!: boolean;
  @Prop({ default: 3 }) maxAutomatedMessages!: number;
  @Prop({ default: 'America/Chicago' }) timeZone!: string;
  @Prop({ default: 20 }) quietStart!: number;
  @Prop({ default: 8 }) quietEnd!: number;
  @Prop({ default: 'Welcome to {{churchName}}' }) subject!: string;
  @Prop({
    default:
      'Hello {{firstName}}, thank you for connecting with {{churchName}}. Let us know how we can help: {{checkInUrl}}',
  })
  message!: string;
  @Prop({ default: 'Bienvenido a {{churchName}}' }) subjectEs!: string;
  @Prop({
    default:
      'Hola {{firstName}}, gracias por conectar con {{churchName}}. Cuéntenos cómo podemos ayudarle: {{checkInUrl}}',
  })
  messageEs!: string;
  @Prop({ default: false }) retentionEmailEnabled!: boolean;
  @Prop({ default: 'Checking in from {{churchName}}' })
  retentionSubject!: string;
  @Prop({
    default:
      'Hello {{firstName}}, how can we support you? You can let your church know here: {{checkInUrl}}',
  })
  retentionMessage!: string;
  @Prop({ default: 'Queremos saber cómo está — {{churchName}}' })
  retentionSubjectEs!: string;
  @Prop({
    default:
      'Hola {{firstName}}, ¿cómo podemos apoyarle? Puede responder a su iglesia aquí: {{checkInUrl}}',
  })
  retentionMessageEs!: string;
  @Prop({ default: false }) attendanceReliable!: boolean;
  @Prop() coverageFrom?: Date;
  @Prop({ default: 21 }) absenceDays!: number;
  @Prop({ default: 3 }) minAttendanceRecords!: number;
  @Prop({ default: true }) weeklyDigest!: boolean;
  @Prop({ default: 0 }) revision!: number;
}
export const CarePlanSchema = SchemaFactory.createForClass(CarePlan);
export type CarePlanDocument = HydratedDocument<CarePlan>;
@Schema({ timestamps: true })
export class CareJob {
  createdAt?: Date;
  @Prop({ required: true, unique: true }) key!: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Branch', required: true })
  branchId!: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'CareCase' })
  caseId?: Types.ObjectId;
  @Prop({ required: true }) kind!: string;
  @Prop({ default: 'queued', index: true }) status!: string;
  @Prop({ required: true, index: true }) dueAt!: Date;
  @Prop() claimedAt?: Date;
  @Prop({ type: Object, default: {} }) data!: Record<string, unknown>;
  @Prop({ default: '' }) result!: string;
}
export const CareJobSchema = SchemaFactory.createForClass(CareJob);
CareJobSchema.index({ status: 1, dueAt: 1 });
export type CareJobDocument = HydratedDocument<CareJob>;
@Schema({ timestamps: true })
export class CareToken {
  @Prop({ required: true, unique: true }) hash!: string;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'CareCase', required: true })
  caseId!: Types.ObjectId;
  @Prop({ required: true }) kind!: string;
  @Prop({ required: true }) expiresAt!: Date;
  @Prop() usedAt?: Date;
  @Prop() processingAt?: Date;
  @Prop() processedAt?: Date;
  @Prop({ type: Object }) payload?: Record<string, unknown>;
}
export const CareTokenSchema = SchemaFactory.createForClass(CareToken);
CareTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type CareTokenDocument = HydratedDocument<CareToken>;
@Schema({ timestamps: true })
export class CareState {
  @Prop({ required: true, unique: true }) key!: string;
  @Prop({ type: Object, default: {} }) value!: Record<string, unknown>;
}
export const CareStateSchema = SchemaFactory.createForClass(CareState);
export type CareStateDocument = HydratedDocument<CareState>;
