import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntakeTemplateDocument = HydratedDocument<IntakeTemplate>;

const TemplateFieldSchema = raw({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, required: true },
  required: { type: Boolean, default: false },
  placeholder: { type: String },
  helpText: { type: String },
  width: { type: String, default: 'half' },
  options: { type: [String], default: [] },
});

const TemplateThemeSchema = raw({
  accentColor: { type: String, default: '#dc2626' },
  darkColor: { type: String, default: '#111827' },
  softColor: { type: String, default: '#fff7ed' },
});

@Schema({ timestamps: true })
export class IntakeTemplate {
  @Prop({ required: true, enum: ['guest', 'member', 'attendance'] })
  kind!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true })
  slug!: string;

  @Prop({ type: Types.ObjectId, ref: 'Branch' })
  branchId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'IntakeTemplate' })
  baseTemplateId?: Types.ObjectId;

  @Prop({ default: false })
  isBranchOverride!: boolean;

  @Prop({ default: false })
  isActive!: boolean;

  @Prop({ default: false })
  isSeeded!: boolean;

  @Prop()
  badge?: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  subtitle?: string;

  @Prop()
  introTitle?: string;

  @Prop()
  introBody?: string;

  @Prop()
  closingText?: string;

  @Prop({ default: 'Submit form' })
  submitLabel!: string;

  @Prop({ default: 'Thank you' })
  successTitle!: string;

  @Prop({ default: 'Your submission has been received.' })
  successMessage!: string;

  @Prop({ default: '/logo.png' })
  logoPath!: string;

  @Prop({ type: TemplateThemeSchema, default: () => ({}) })
  theme!: {
    accentColor?: string;
    darkColor?: string;
    softColor?: string;
  };

  @Prop({ type: [TemplateFieldSchema], default: [] })
  fields!: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    placeholder?: string;
    helpText?: string;
    width?: string;
    options?: string[];
  }>;
}

export const IntakeTemplateSchema = SchemaFactory.createForClass(IntakeTemplate);
