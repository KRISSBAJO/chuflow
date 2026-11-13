import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateGuestDto {
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  formRevision?: number;

  @ApiProperty()
  @IsMongoId()
  branchId!: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^(?:\s*$|(?=(?:\D*\d){7,15}\D*$)[+\d() .-]{7,50})$/)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  confirmDistinctGuest?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || undefined : value)
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  spouseDetails?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  children?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  invitedBy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  heardAboutChurch?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prayerRequest?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  wantsPastoralCall?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  salvationResponse?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  visitStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  visitDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  assignedFollowUpUserId?: string;
}

export class UpdateGuestDto extends PartialType(OmitType(CreateGuestDto, ['customFields', 'formRevision', 'prayerRequest', 'wantsPastoralCall', 'confirmDistinctGuest'] as const)) {}
