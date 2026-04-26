import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AppSettingDocument = HydratedDocument<AppSetting>;

@Schema({ timestamps: true })
export class AppSetting {
  @Prop({ required: true, unique: true, default: 'global' })
  scopeKey!: string;

  @Prop({ required: true, default: 'ChuFlow' })
  organizationName!: string;

  @Prop({ required: true, default: 'From Membership to Ministry' })
  organizationTagline!: string;

  @Prop({ default: true })
  publicConnectEnabled!: boolean;

  @Prop({ default: 30 })
  defaultReportDays!: number;
}

export const AppSettingSchema = SchemaFactory.createForClass(AppSetting);
