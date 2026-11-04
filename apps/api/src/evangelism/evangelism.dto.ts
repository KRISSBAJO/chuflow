import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  Matches,
  IsMongoId,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export const OUTREACH_STAGES = [
  'new',
  'contacted',
  'prayed_with',
  'invited',
  'visited',
  'discipleship',
  'closed',
  'do_not_contact',
] as const;
export const OUTREACH_METHODS = [
  'phone_call',
  'text_message',
  'whatsapp',
  'email',
  'in_person',
] as const;

export class CreateOutreachLinkDto {
  @IsOptional() @Matches(/^#[0-9a-f]{6}$/i) headerTextColor?: string | null;
  @IsOptional() @Matches(/^#[0-9a-f]{6}$/i) buttonTextColor?: string | null;
  @IsOptional() @Matches(/^#[0-9a-f]{6}$/i) headerColor?: string | null;
  @IsOptional() @Matches(/^#[0-9a-f]{6}$/i) buttonColor?: string | null;

  @IsOptional() @IsString() @Length(2, 150) churchName?: string;
  @IsMongoId() branchId!: string;
  @IsString() @Length(2, 100) name!: string;
  @IsIn(['personal', 'branch']) kind!: 'personal' | 'branch';
}

export class CaptureOutreachDto {
  @IsString() @Length(1, 80) firstName!: string;
  @IsString() @Length(1, 80) lastName!: string;
  @IsString() @Length(7, 30) phone!: string;
  @IsOptional() @IsEmail() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(150) city?: string;
  @IsOptional() @IsString() @MaxLength(1000) prayerRequest?: string;
  @IsOptional()
  @IsIn([
    'prayer',
    'learn_about_faith',
    'church_visit',
    'pastoral_call',
    'stay_connected',
  ])
  interest?: string;
  @IsOptional() @IsString() @MaxLength(150) preferredContactTime?: string;
  @IsIn(OUTREACH_METHODS) preferredContactMethod!: string;
  @IsBoolean() consentToContact!: boolean;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

export class CreateOutreachContactDto extends CaptureOutreachDto {
  @IsMongoId() branchId!: string;
}

export class UpdateOutreachDto {
  @IsIn(OUTREACH_STAGES) stage!: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) note!: string;
  @IsIn([...OUTREACH_METHODS, 'administrative']) contactMethod!: string;
  @IsOptional() @IsMongoId() assignedTo?: string;
  @IsOptional() @IsBoolean() unassign?: boolean;
  @IsOptional() @IsDateString() nextActionDate?: string;
  @IsOptional() @IsBoolean() clearNextAction?: boolean;
}

export class UpdateOutreachLinkDto {
  @IsOptional() @Matches(/^#[0-9a-f]{6}$/i) headerTextColor?: string | null;
  @IsOptional() @Matches(/^#[0-9a-f]{6}$/i) buttonTextColor?: string | null;
  @IsOptional() @Matches(/^#[0-9a-f]{6}$/i) headerColor?: string | null;
  @IsOptional() @Matches(/^#[0-9a-f]{6}$/i) buttonColor?: string | null;

  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @Length(2, 150) churchName?: string;
  @IsOptional() @IsString() @Length(2, 100) name?: string;
}

export class LinkOutreachGuestDto {
  @IsMongoId() guestId!: string;
}

export class OutreachListQueryDto {
  @IsOptional() @IsMongoId() branchId?: string;
  @IsOptional() @IsIn(OUTREACH_STAGES) stage?: string;
  @IsOptional() @IsIn(['mine', 'unassigned', 'overdue']) queue?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsNumberString({ no_symbols: true }) page?: string;
}
