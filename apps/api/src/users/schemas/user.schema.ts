import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { APP_ROLES } from '../../common/constants/roles.constants';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class UserPreferences {
  @Prop({ default: 'comfortable' })
  interfaceDensity!: string;

  @Prop({ default: 30 })
  defaultReportDays!: number;
}

export const UserPreferencesSchema = SchemaFactory.createForClass(UserPreferences);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  firstName!: string;

  @Prop({ required: true })
  lastName!: string;

  @Prop({ required: true, unique: true, index: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({ select: false })
  passwordResetToken?: string;

  @Prop()
  passwordResetExpiresAt?: Date;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ required: true, enum: APP_ROLES })
  role!: string;

  @Prop()
  oversightRegion?: string;

  @Prop()
  district?: string;

  @Prop({ type: Types.ObjectId, ref: 'Branch' })
  branchId?: Types.ObjectId;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: UserPreferencesSchema, default: () => ({}) })
  preferences?: UserPreferences;
}

export const UserSchema = SchemaFactory.createForClass(User);
