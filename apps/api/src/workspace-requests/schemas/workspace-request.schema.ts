import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type WorkspaceRequestDocument = HydratedDocument<WorkspaceRequest>;

@Schema({ timestamps: true })
export class WorkspaceRequest {
  @Prop({ required: true })
  organizationName!: string;

  @Prop()
  workspaceHandle?: string;

  @Prop()
  workspaceHandleClaimed?: boolean;

  @Prop({ required: true })
  contactName!: string;

  @Prop({ required: true })
  email!: string;

  @Prop()
  phone?: string;

  @Prop()
  country?: string;

  @Prop()
  state?: string;

  @Prop()
  city?: string;

  @Prop()
  branchCount?: number;

  @Prop()
  notes?: string;

  @Prop({ default: 'new' })
  status!: string;

  @Prop({ default: 'queued' })
  notificationStatus!: string;

  @Prop()
  adminNotifiedAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop()
  decisionNotes?: string;
}

export const WorkspaceRequestSchema =
  SchemaFactory.createForClass(WorkspaceRequest);

WorkspaceRequestSchema.index(
  { workspaceHandle: 1 },
  { unique: true, partialFilterExpression: { workspaceHandleClaimed: true } },
);
