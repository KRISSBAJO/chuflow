import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateGuestDto {
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

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty({ required: false })
  @IsOptional()
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

export class UpdateGuestDto extends PartialType(CreateGuestDto) {}
